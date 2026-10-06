"""Tries ResistanceTracker (charge_estimate.py) with an invented pack: rest voltage 7680 mV, 0.6 ohm between the HAT and the
cells. Plugging the charger in or pulling it out steps the battery current, and the voltage steps with it.
Run: python3 test_resistance.py"""

import os
import random
import sys
import tempfile

sys.path.insert(0, os.path.dirname(__file__))
from charge_estimate import ResistanceTracker  # noqa: E402

OCV = 7680.0
R = 0.6
STEP = 5.0
random.seed(7)


def feed(tr, clk, seconds, i_ma, noise=True, ocv=OCV, r=R, valid=True, v_fixed=None):
    for _ in range(int(seconds / STEP)):
        clk[0] += STEP
        i = i_ma + (random.uniform(-20, 20) if noise else 0)
        v = v_fixed if v_fixed is not None else ocv + i * r + (random.uniform(-8, 8) if noise else 0)
        tr.add(v, i, valid)


with tempfile.TemporaryDirectory() as tmp:
    path = os.path.join(tmp, "var", "lib", "mupihat", "pack_resistance.json")
    clk = [0.0]
    tr = ResistanceTracker(clock=lambda: clk[0], wall=lambda: clk[0], persist_file=path)
    assert tr.ohm == tr.DEFAULT_OHM and not tr.measured

    # steady discharge: nothing to measure
    feed(tr, clk, 120, -690)
    assert not tr.measured, "measured without a step"

    # the charger is plugged in: -690 mA -> +560 mA
    feed(tr, clk, 40, 560)
    assert tr.measured and abs(tr.ohm - R) < 0.05, (tr.measured, tr.ohm)
    print(f"plug in: {tr.ohm:.3f} ohm (truth {R})")
    assert os.path.exists(path), "not kept on the memory card"

    # pulled out again: the second measurement moves the value only a little
    feed(tr, clk, 40, -690)
    assert abs(tr.ohm - R) < 0.05 and tr.count == 2, (tr.ohm, tr.count)
    print(f"pull out: {tr.ohm:.3f} ohm after {tr.count} measurements")

    # a new tracker (the service restarted) takes the value from the card
    again = ResistanceTracker(clock=lambda: clk[0], wall=lambda: clk[0], persist_file=path)
    assert again.measured and abs(again.ohm - tr.ohm) < 1e-9 and again.count == 2

    # a small step (200 mA) is not a measurement
    small = ResistanceTracker(clock=lambda: clk[0])
    feed(small, clk, 60, -300)
    feed(small, clk, 40, -100)
    assert not small.measured

    # a step while the charger holds the voltage (CV): the voltage does not follow, valid=False drops what was collected
    cv = ResistanceTracker(clock=lambda: clk[0])
    feed(cv, clk, 60, 1500, valid=False, v_fixed=8300)
    feed(cv, clk, 40, 500, valid=False, v_fixed=8300)
    assert not cv.measured
    # ... and even if such samples were taken as valid: a voltage that does not move gives 0 ohm, which is refused
    cv2 = ResistanceTracker(clock=lambda: clk[0])
    feed(cv2, clk, 60, 1500, v_fixed=8300)
    feed(cv2, clk, 40, 500, v_fixed=8300)
    assert not cv2.measured and cv2.ohm == cv2.DEFAULT_OHM

    # the voltage going the wrong way (negative resistance): refused
    bad = ResistanceTracker(clock=lambda: clk[0])
    feed(bad, clk, 60, -690, r=-0.5)
    feed(bad, clk, 40, 560, r=-0.5)
    assert not bad.measured

    # loud music: the current is not steady before the step, no measurement
    loud = ResistanceTracker(clock=lambda: clk[0])
    for _ in range(12):
        clk[0] += STEP
        i = random.choice([-300, -1100])
        loud.add(OCV + i * R, i)
    feed(loud, clk, 40, 560)
    assert not loud.measured

    # a measured value outside what a pack can be (more than 2 ohm) is refused
    huge = ResistanceTracker(clock=lambda: clk[0])
    feed(huge, clk, 60, -690, r=4.0)
    feed(huge, clk, 40, 560, r=4.0)
    assert not huge.measured

    # a damaged file on the card is ignored
    broken = os.path.join(tmp, "broken.json")
    with open(broken, "w") as f:
        f.write("{not json")
    assert ResistanceTracker(persist_file=broken).ohm == ResistanceTracker.DEFAULT_OHM
print("resistance: ok")

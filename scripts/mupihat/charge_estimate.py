"""Percent while charging and time until the battery is full (MuPiHAT, BQ25792).

The charger holds the pack above its rest voltage while it charges, so the voltage alone reads "full" almost as soon as
the cable is plugged in. This module does what the voltage cannot:

  * the charge that went in is counted (current x time) from the percent the pack had before the cable was plugged in,
  * the step from constant current (CC) to constant voltage (CV) is a known point (about 85 %), and in the CV phase the
    current falls off until the charger ends the charge - how far it has fallen says how far the pack is,
  * the time left is the rest of the CC phase (charge still to go / the current) plus the CV tail, which follows the
    measured fall of the current (a fit of ln(I) over the last minutes) or, until that is known, a typical time constant.

It is an estimate: the capacity is the one of the profile (a pack gets smaller with age), and the box itself takes power
while it charges. No I2C in here, so it can be tried with recorded or invented values (see test_charge_estimate.py).
"""

import json
import math
import os
import time
from collections import deque

def _system_uptime():
    """Seconds since the system started (a huge number where it cannot be told: nothing is restored then)."""
    try:
        with open("/proc/uptime") as f:
            return float(f.read().split()[0])
    except (OSError, ValueError, IndexError):
        return 1e12


CHARGING_PHASES = ("precharge", "cc", "cv", "topoff")


def phase_of(status):
    """The charge state of the chip's text ("Fast charge (CC mode)" ...) as one of idle, precharge, cc, cv, topoff, done."""
    s = (status or "").lower()
    if not s or "not charging" in s or "reserved" in s:
        return "idle"
    if "termination" in s or "done" in s:
        return "done"
    if "top-off" in s or "top off" in s:
        return "topoff"
    if "taper" in s or "cv" in s:
        return "cv"
    if "fast" in s or "cc" in s:
        return "cc"
    if "pre" in s or "trickle" in s:
        return "precharge"
    return "idle"


class ChargeEstimator:
    # where a lithium pack goes over from constant current to constant voltage, in percent of its capacity
    CC_END_PCT = 85.0
    # share of the charge that stays in the pack
    EFFICIENCY = 0.97
    # typical time constant of the CV phase in hours per (capacity / charge current in hours); only until the fall of the
    # current has been measured
    TAU_FACTOR = 0.10
    # a current below this is not charging (noise of the ADC, the pack idling)
    MIN_CHARGE_MA = 15
    # the time constant of the smoothing of the charge current, in seconds
    CURRENT_SMOOTHING_S = 60
    # how long a quiet stretch of the pack is remembered as the starting point, in seconds
    REST_WINDOW_S = 600
    # more than this many hours is no estimate
    MAX_ETA_H = 24
    # the constant-voltage phase counts when the voltage is within this of the charge limit, for this many readings in a row
    CV_NEAR_LIMIT_MV = 250
    CV_CONFIRM_READINGS = 3
    # in the CC phase a percent that is this much above the count of the charge is taken back to the count
    HEAL_PCT = 10.0
    # a charge that was running when the box was restarted goes on where it was, for this many seconds after the start of
    # the system (the state in /tmp is gone after a restart, so it is also kept on the memory card, at most this often)
    REBOOT_WINDOW_S = 900
    PERSIST_EVERY_S = 60

    def __init__(self, capacity_mah=None, iterm_ma=200, clock=time.monotonic, wall=time.time, state_file=None, persist_file=None, uptime=None):
        self.capacity = capacity_mah if capacity_mah and capacity_mah > 0 else None
        self.iterm = max(50, iterm_ma or 200)
        self._clock = clock
        self._wall = wall
        self._state_file = state_file
        self._persist_file = persist_file
        self._uptime = uptime or _system_uptime
        self._persist_active = None
        self._persist_wall = 0.0
        self._rest = deque()  # (t, percent by voltage) while not charging
        self._last_t = None
        self._cv_streak = 0
        self.reset_session()
        self._restore()

    # --- what the user of this class reads
    percent = None  # the estimate while charging (float), else None
    eta_min = None  # minutes until full, else None
    phase = "idle"

    def reset_session(self):
        self.active = False
        self.start_uncertain = False  # True: the starting point is only the voltage (nothing known from before the charge)
        self.start_pct = 0.0
        self.charged_mah = 0.0
        self.ema = None
        self.cc_peak = 0.0
        self.cv_i0 = None
        self._cv = deque()  # (t, ln(I)) in the CV phase
        self.percent = None
        self.eta_min = None

    def set_capacity(self, capacity_mah):
        self.capacity = capacity_mah if capacity_mah and capacity_mah > 0 else None

    # --- feeding
    def update(self, ibat_ma, status, voltage_pct, vbat_mv=None, vreg_mv=None, vrest_mv=None):
        """One reading (every few seconds): battery current in mA (+ = charging), the chip's charge state, and the percent
        the voltage alone says (a float, with the voltage drop of the charge current taken off). With the battery voltage
        and the charge limit (VREG) the constant-voltage phase is told from a false report of it. vrest_mv is the battery
        voltage less the drop the current causes in the pack (what the pack would read at rest): with a pack of high
        resistance the terminals reach the charge limit long before the cells are full, and the chip reports CV then."""
        now = self._clock()
        dt = 0.0 if self._last_t is None else min(30.0, max(0.0, now - self._last_t))
        self._last_t = now
        ph = phase_of(status)
        # The chip reports "Taper (CV mode)" for a moment now and then while it is still far from its charge limit (when
        # the input gives way, at a change of the cable ...). The CV phase is only taken for real when the voltage is near
        # the limit and the report stays for a few readings - a single wrong one set the percent to 99 for good. The same for
        # "termination done": with a pack of high resistance and a box that takes most of the input, the charge current
        # falls below the termination current for a moment, and the chip says "done" while the cells are far from full.
        if ph in ("cv", "done"):
            v_check = vrest_mv if vrest_mv is not None else vbat_mv
            near_limit = v_check is None or vreg_mv is None or v_check >= vreg_mv - self.CV_NEAR_LIMIT_MV
            self._cv_streak = self._cv_streak + 1 if near_limit else 0
            if self._cv_streak < self.CV_CONFIRM_READINGS:
                ph = "cc"
        else:
            self._cv_streak = 0
        self.phase = ph
        charging = ph in CHARGING_PHASES and ibat_ma is not None and ibat_ma > self.MIN_CHARGE_MA

        if not charging and ph != "done":
            # at rest or discharging: the voltage is the best there is, and it is what a charge will start from
            if self.active:
                # the charge ends (cable out, or the chip stops for a moment): what was reached stays the starting point
                # of the next one - the old readings from before the charge are of no use any more
                last = self.percent
                self.reset_session()
                self._rest.clear()
                if last is not None:
                    self._rest.append((now - 25, last))
                self._save()
            if voltage_pct is not None:
                self._rest.append((now, float(voltage_pct)))
            while self._rest and now - self._rest[0][0] > self.REST_WINDOW_S:
                self._rest.popleft()
            self.percent = None
            self.eta_min = None
            return

        if ph == "done":
            self.percent = 100.0
            self.eta_min = 0
            self.active = True
            self.start_uncertain = False
            self._save()
            return

        if not self.active:
            self.active = True
            self.start_pct, known = self._starting_point(now, voltage_pct)
            self.start_uncertain = not known
            self.charged_mah = 0.0
            self.ema = None
            self.cc_peak = 0.0
            self.cv_i0 = None
            self._cv.clear()
            self.percent = self.start_pct

        i = float(ibat_ma)
        self.ema = i if self.ema is None else self.ema + (i - self.ema) * min(1.0, dt / self.CURRENT_SMOOTHING_S if dt else 1.0)
        self.charged_mah += max(i, 0.0) * dt / 3600.0 * self.EFFICIENCY

        pct = self.start_pct + (self.charged_mah / self.capacity * 100.0 if self.capacity else 0.0)
        if ph == "cc":
            self.cc_peak = max(self.cc_peak, self.ema)
            pct = min(pct, self.CC_END_PCT)
        elif ph == "cv":
            if self.cv_i0 is None:
                # the step over to CV is a known point: take the count to it
                self.cv_i0 = max(i, self.iterm * 1.5)
                self.start_uncertain = False
                self.cc_peak = max(self.cc_peak, self.cv_i0)
                pct = self.CC_END_PCT
            span = math.log(max(self.cv_i0, self.iterm * 1.01) / self.iterm)
            fall = math.log(max(min(i, self.cv_i0), self.iterm) / self.iterm)
            pct = self.CC_END_PCT + (100.0 - self.CC_END_PCT) * (1.0 - fall / span if span > 0 else 1.0)
            self._cv.append((now, math.log(max(i, 1.0))))
            while self._cv and now - self._cv[0][0] > 600:
                self._cv.popleft()
        elif ph == "topoff":
            pct = max(pct, 97.0)
        # a value far above what the charge counted comes from a false report of the chip: back to the count
        if ph == "cc" and self.percent is not None and self.percent - pct > self.HEAL_PCT:
            self.percent = pct
        # never backwards within a charge, never "full" before the charger says so
        pct = max(pct, self.percent or 0.0)
        self.percent = min(pct, 99.0)
        self.eta_min = self._eta(ph)
        self._save()

    # --- parts
    def _starting_point(self, now, voltage_pct):
        """The percent before the charge: the middle of what the voltage said while the pack was at rest."""
        old = sorted(p for (t, p) in self._rest if now - t >= 20)
        if old:
            return old[len(old) // 2], True
        if self._rest:
            return sorted(p for (_, p) in self._rest)[len(self._rest) // 2], True
        # nothing from before the charge (the service started while it charged): only the voltage is left - a guess
        return (float(voltage_pct) if voltage_pct is not None else 0.0), False

    def _tau_s(self):
        """Time constant of the fall of the current in the CV phase, in seconds."""
        if len(self._cv) >= 6 and self._cv[-1][0] - self._cv[0][0] >= 120:
            n = len(self._cv)
            mt = sum(t for t, _ in self._cv) / n
            my = sum(y for _, y in self._cv) / n
            den = sum((t - mt) ** 2 for t, _ in self._cv)
            slope = sum((t - mt) * (y - my) for t, y in self._cv) / den if den else 0.0
            if slope < -2e-5:
                return min(max(-1.0 / slope, 120.0), 4 * 3600.0)
        if not self.capacity:
            return None
        icc = max(self.cc_peak, self.cv_i0 or 0.0, self.iterm * 2)
        return self.TAU_FACTOR * self.capacity / icc * 3600.0

    def _eta(self, ph):
        if ph == "precharge":
            return None
        if ph == "topoff":
            return 10
        i_now = self.ema if self.ema else 0.0
        if i_now < self.MIN_CHARGE_MA * 2:
            return None  # hardly anything goes in (the box takes what the input gives): no time to name
        tau = self._tau_s()
        if tau is None:
            return None
        if ph == "cv":
            seconds = tau * math.log(max(i_now, self.iterm * 1.01) / self.iterm)
        else:  # cc
            if not self.capacity:
                return None
            to_go_mah = max(0.0, (self.CC_END_PCT - (self.percent or 0.0)) / 100.0 * self.capacity) / self.EFFICIENCY
            start_cv = max(self.cc_peak, i_now, self.iterm * 2)
            seconds = to_go_mah / i_now * 3600.0 + tau * math.log(start_cv / self.iterm)
        if seconds > self.MAX_ETA_H * 3600:
            return None
        return int(round(seconds / 60.0 / 5.0) * 5)

    # --- a restart of the service in the middle of a charge goes on where it was
    def _state(self):
        return {"wall": self._wall(), "active": self.active, "start_pct": self.start_pct, "charged_mah": self.charged_mah, "cc_peak": self.cc_peak, "cv_i0": self.cv_i0, "percent": self.percent, "start_uncertain": self.start_uncertain}

    def _write(self, path, data):
        tmp = path + ".tmp"
        with open(tmp, "w") as f:
            json.dump(data, f)
        os.replace(tmp, path)

    def _save(self):
        data = self._state()
        if self._state_file:
            try:
                self._write(self._state_file, data)
            except OSError:
                pass
        # (also on the memory card, for a restart of the whole box: when a charge starts or ends, else once a minute)
        if self._persist_file and (data["active"] != self._persist_active or data["wall"] - self._persist_wall >= self.PERSIST_EVERY_S):
            try:
                os.makedirs(os.path.dirname(self._persist_file), exist_ok=True)
                self._write(self._persist_file, data)
                self._persist_active = data["active"]
                self._persist_wall = data["wall"]
            except OSError:
                pass

    @staticmethod
    def _read(path):
        if not path:
            return None
        try:
            with open(path) as f:
                data = json.load(f)
            return data if isinstance(data, dict) and data.get("active") else None
        except (OSError, ValueError, TypeError):
            return None

    def _apply(self, data):
        self.active = True
        self.start_pct = float(data["start_pct"])
        self.charged_mah = float(data["charged_mah"])
        self.cc_peak = float(data.get("cc_peak") or 0.0)
        self.cv_i0 = data.get("cv_i0")
        self.percent = data.get("percent")
        self.start_uncertain = bool(data.get("start_uncertain", False))

    def _restore(self):
        try:
            data = self._read(self._state_file)
            if data and self._wall() - float(data.get("wall", 0)) < 120:
                self._apply(data)
                return
            # the state in /tmp is gone (the box was restarted): the one on the memory card counts for a short while after
            # the start of the system - a charge that was running goes on, it does not start from a guess of the voltage
            data = self._read(self._persist_file)
            if data and self._uptime() < self.REBOOT_WINDOW_S:
                self._apply(data)
        except (ValueError, KeyError, TypeError):
            pass


class ResistanceTracker:
    """Measures the resistance between the HAT and the cells (cells, holders, wires, the BMS) from the steps of the battery
    current: V = OCV + I x R, and within a few seconds of a step (the charger plugged in or pulled, the box's load going up
    or down) the open-circuit voltage OCV has not moved, so  R = (V after - V before) / (I after - I before).

    The pack's rest voltage is then  V - I x R  (I positive = charging), in the charge as at the load of the music. Until a
    step has been seen the value of before is used (a typical pack: 0.12 ohm); a measured value is kept on the memory card.
    No I2C in here (see test_resistance.py)."""

    DEFAULT_OHM = 0.12
    MIN_OHM = 0.02
    MAX_OHM = 2.0
    # a step is a change of the current by at least this much between two readings ...
    MIN_STEP_MA = 400
    # ... with the current steady (within this) in the seconds before and after it
    SPREAD_MA = 250
    BEFORE_S = 25.0
    AFTER_S = 8.0  # only the first seconds after the step: the polarisation of the cells is still small then
    KEEP_S = 90.0
    ALPHA = 0.3  # how much a new measurement counts against the old value

    def __init__(self, clock=time.monotonic, wall=time.time, persist_file=None):
        self._clock = clock
        self._wall = wall
        self._persist_file = persist_file
        self._samples = deque()  # (t, mV, mA)
        self._done_t = -1.0
        self.ohm = self.DEFAULT_OHM
        self.measured = False
        self.count = 0
        self._load()

    def add(self, vbat_mv, ibat_ma, valid=True):
        """One reading (every few seconds). valid=False while the charger holds the voltage (CV phase, top-off, done): the
        voltage does not follow the current then, nothing can be measured and what was collected is dropped."""
        if not valid or vbat_mv is None or ibat_ma is None:
            self._samples.clear()
            return
        now = self._clock()
        self._samples.append((now, float(vbat_mv), float(ibat_ma)))
        while self._samples and now - self._samples[0][0] > self.KEEP_S:
            self._samples.popleft()
        self._evaluate()

    @staticmethod
    def _median(values):
        v = sorted(values)
        return v[len(v) // 2] if len(v) % 2 else (v[len(v) // 2 - 1] + v[len(v) // 2]) / 2.0

    def _evaluate(self):
        s = list(self._samples)
        for k in range(len(s) - 1, 0, -1):
            t1 = s[k][0]
            if t1 <= self._done_t:
                return
            if abs(s[k][2] - s[k - 1][2]) < self.MIN_STEP_MA:
                continue
            if s[-1][0] - t1 < self.AFTER_S:
                return  # the seconds after the step are not over yet
            self._done_t = t1
            before = [x for x in s[:k] if s[k - 1][0] - x[0] <= self.BEFORE_S]
            after = [x for x in s[k:] if x[0] - t1 <= self.AFTER_S]
            if len(before) < 3 or len(after) < 2:
                return
            if max(x[2] for x in before) - min(x[2] for x in before) > self.SPREAD_MA:
                return
            if max(x[2] for x in after) - min(x[2] for x in after) > self.SPREAD_MA:
                return
            d_i = self._median([x[2] for x in after]) - self._median([x[2] for x in before])
            d_v = self._median([x[1] for x in after]) - self._median([x[1] for x in before])
            if abs(d_i) < self.MIN_STEP_MA:
                return
            r = d_v / d_i
            if not (self.MIN_OHM <= r <= self.MAX_OHM):
                return  # a voltage that did not follow the current (or the wrong way): not a measurement of the pack
            self.ohm = r if not self.measured else self.ohm + (r - self.ohm) * self.ALPHA
            self.measured = True
            self.count += 1
            self._save()
            return

    def _save(self):
        if not self._persist_file:
            return
        try:
            os.makedirs(os.path.dirname(self._persist_file), exist_ok=True)
            tmp = self._persist_file + ".tmp"
            with open(tmp, "w") as f:
                json.dump({"ohm": self.ohm, "count": self.count, "wall": self._wall()}, f)
            os.replace(tmp, self._persist_file)
        except OSError:
            pass

    def _load(self):
        if not self._persist_file:
            return
        try:
            with open(self._persist_file) as f:
                data = json.load(f)
            ohm = float(data["ohm"])
            if self.MIN_OHM <= ohm <= self.MAX_OHM:
                self.ohm = ohm
                self.measured = True
                self.count = int(data.get("count", 1))
        except (OSError, ValueError, KeyError, TypeError):
            pass

let BackgroundColorDef;
(function () {
  BackgroundColorDef = function (
    gradientStart,
    gradientFraction,
    gradientStop,
    labelColor,
    symbolColor,
    name
  ) {
    this.gradientStart = gradientStart;
    this.gradientFraction = gradientFraction;
    this.gradientStop = gradientStop;
    this.labelColor = labelColor;
    this.symbolColor = symbolColor;
    this.name = name;
  };
})();

let LcdColorDef;
(function () {
  LcdColorDef = function (
    gradientStartColor,
    gradientFraction1Color,
    gradientFraction2Color,
    gradientFraction3Color,
    gradientStopColor,
    textColor
  ) {
    this.gradientStartColor = gradientStartColor;
    this.gradientFraction1Color = gradientFraction1Color;
    this.gradientFraction2Color = gradientFraction2Color;
    this.gradientFraction3Color = gradientFraction3Color;
    this.gradientStopColor = gradientStopColor;
    this.textColor = textColor;
  };
})();

let ColorDef;
(function () {
  ColorDef = function (veryDark, dark, medium, light, lighter, veryLight) {
    this.veryDark = veryDark;
    this.dark = dark;
    this.medium = medium;
    this.light = light;
    this.lighter = lighter;
    this.veryLight = veryLight;
  };
})();

let LedColorDef;
(function () {
  LedColorDef = function (
    innerColor1_ON,
    innerColor2_ON,
    outerColor_ON,
    coronaColor,
    innerColor1_OFF,
    innerColor2_OFF,
    outerColor_OFF
  ) {
    this.innerColor1_ON = innerColor1_ON;
    this.innerColor2_ON = innerColor2_ON;
    this.outerColor_ON = outerColor_ON;
    this.coronaColor = coronaColor;
    this.innerColor1_OFF = innerColor1_OFF;
    this.innerColor2_OFF = innerColor2_OFF;
    this.outerColor_OFF = outerColor_OFF;
  };
})();

let GaugeTypeDef;
(function () {
  GaugeTypeDef = function (type) {
    this.type = type;
  };
})();

let OrientationDef;
(function () {
  OrientationDef = function (type) {
    this.type = type;
  };
})();

let KnobTypeDef;
(function () {
  KnobTypeDef = function (type) {
    this.type = type;
  };
})();

let KnobStyleDef;
(function () {
  KnobStyleDef = function (style) {
    this.style = style;
  };
})();

let FrameDesignDef;
(function () {
  FrameDesignDef = function (design) {
    this.design = design;
  };
})();

let PointerTypeDef;
(function () {
  PointerTypeDef = function (type) {
    this.type = type;
  };
})();

let ForegroundTypeDef;
(function () {
  ForegroundTypeDef = function (type) {
    this.type = type;
  };
})();

let LabelNumberFormatDef;
(function () {
  LabelNumberFormatDef = function (format) {
    this.format = format;
  };
})();

let TickLabelOrientationDef;
(function () {
  TickLabelOrientationDef = function (type) {
    this.type = type;
  };
})();

let TrendStateDef;
(function () {
  TrendStateDef = function (state) {
    this.state = state;
  };
})();

const HALF_PI = Math.PI * 0.5;
const TWO_PI = Math.PI * 2;
const PI = Math.PI;
const RAD_FACTOR = Math.PI / 180;
const DEG_FACTOR = 180 / Math.PI;
const doc = document;
const lcdFontName = 'LCDMono2Ultra,Arial,Verdana,sans-serif';
const stdFontName = 'Arial,Verdana,sans-serif';

const rgbaColor = function (r, g, b, a) {
  let red;
  let green;
  let blue;
  let alpha;

  if (arguments.length === 1) {
    // hexadecimal input #112233
    b = parseInt(r.substr(5, 2), 16);
    g = parseInt(r.substr(3, 2), 16);
    r = parseInt(r.substr(1, 2), 16);
    a = 1;
  } else if (arguments.length === 3) {
    a = 1;
  }

  function validateColors () {
    red = range(r, 255);
    green = range(g, 255);
    blue = range(b, 255);
    alpha = range(a, 1);
  }

  validateColors();

  this.getRed = function () {
    return red
  };

  this.setRed = function (r) {
    red = range(r, 255);
  };

  this.getGreen = function () {
    return green
  };

  this.setGreen = function (g) {
    green = range(g, 255);
  };

  this.getBlue = function () {
    return blue
  };

  this.setBlue = function (b) {
    blue = range(b, 255);
  };

  this.getAlpha = function () {
    return alpha
  };

  this.setAlpha = function (a) {
    alpha = range(a, 1);
  };

  this.getRgbaColor = function () {
    return 'rgba(' + red + ', ' + green + ', ' + blue + ', ' + alpha + ')'
  };

  this.getRgbColor = function () {
    return 'rgb(' + red + ', ' + green + ', ' + blue + ')'
  };

  this.getHexColor = function () {
    return '#' + red.toString(16) + green.toString(16) + blue.toString(16)
  };
};

const ConicalGradient = function (fractions, colors) {
  const limit = fractions.length - 1;
  let i;

  // Pre-multipy fractions array into range -PI to PI
  for (i = 0; i <= limit; i++) {
    fractions[i] = TWO_PI * fractions[i] - PI;
  }

  this.fillCircle = function (ctx, centerX, centerY, innerX, outerX) {
    let angle;
    const radius = Math.ceil(outerX);
    const diameter = radius * 2;
    let x;
    let y;
    let dx;
    let dy;
    let dy2;
    let distance;
    let indx;
    let pixColor;

    // Create pixel array
    const pixels = ctx.createImageData(diameter, diameter);
    const alpha = 255;

    for (y = 0; y < diameter; y++) {
      dy = radius - y;
      dy2 = dy * dy;
      for (x = 0; x < diameter; x++) {
        dx = x - radius;
        distance = Math.sqrt(dx * dx + dy2);
        if (distance <= radius && distance >= innerX) {
          // pixels are transparent by default, so only paint the ones we need
          angle = Math.atan2(dx, dy);
          for (i = 0; i < limit; i++) {
            if (angle >= fractions[i] && angle < fractions[i + 1]) {
              pixColor = getColorFromFraction(
                colors[i],
                colors[i + 1],
                fractions[i + 1] - fractions[i],
                angle - fractions[i],
                true
              );
            }
          }
          // The pixel array is addressed as 4 elements per pixel [r,g,b,a]
          // plot is 180 rotated from orginal method, so apply a simple invert (diameter - y)
          indx = (diameter - y) * diameter * 4 + x * 4;
          pixels.data[indx] = pixColor[0];
          pixels.data[indx + 1] = pixColor[1];
          pixels.data[indx + 2] = pixColor[2];
          pixels.data[indx + 3] = alpha;
        }
      }
    }

    // Create a new buffer to apply the raw data so we can rotate it
    const buffer = createBuffer(diameter, diameter);
    const bufferCtx = buffer.getContext('2d');
    bufferCtx.putImageData(pixels, 0, 0);
    // Apply the image buffer
    ctx.drawImage(buffer, centerX - radius, centerY - radius);
  };

  this.fillRect = function (
    ctx,
    centerX,
    centerY,
    width,
    height,
    thicknessX,
    thicknessY
  ) {
    let angle;
    let x;
    let y;
    let dx;
    let dy;
    let indx;
    let pixColor;

    width = Math.ceil(width);
    height = Math.ceil(height);
    const width2 = width / 2;
    const height2 = height / 2;
    thicknessX = Math.ceil(thicknessX);
    thicknessY = Math.ceil(thicknessY);

    // Create pixel array
    const pixels = ctx.createImageData(width, height);
    const alpha = 255;

    for (y = 0; y < height; y++) {
      dy = height2 - y;
      for (x = 0; x < width; x++) {
        if (y > thicknessY && y <= height - thicknessY) {
          // we are in the range where we only draw the sides
          if (x > thicknessX && x < width - thicknessX) {
            // we are in the empty 'middle', jump to the next edge
            x = width - thicknessX;
          }
        }
        dx = x - width2;
        angle = Math.atan2(dx, dy);
        for (i = 0; i < limit; i++) {
          if (angle >= fractions[i] && angle < fractions[i + 1]) {
            pixColor = getColorFromFraction(
              colors[i],
              colors[i + 1],
              fractions[i + 1] - fractions[i],
              angle - fractions[i],
              true
            );
          }
        }
        // The pixel array is addressed as 4 elements per pixel [r,g,b,a]
        // plot is 180 rotated from orginal method, so apply a simple invert (height - y)
        indx = (height - y) * width * 4 + x * 4;
        pixels.data[indx] = pixColor[0];
        pixels.data[indx + 1] = pixColor[0];
        pixels.data[indx + 2] = pixColor[0];
        pixels.data[indx + 3] = alpha;
      }
    }
    // Create a new buffer to apply the raw data so we can clip it when drawing to canvas
    const buffer = createBuffer(width, height);
    const bufferCtx = buffer.getContext('2d');
    bufferCtx.putImageData(pixels, 0, 0);

    // draw the buffer back to the canvas
    ctx.drawImage(buffer, centerX - width2, centerY - height2);
  };
};

const gradientWrapper = function (start, end, fractions, colors) {
  this.getColorAt = function (fraction) {
    let lowerLimit = 0;
    let lowerIndex = 0;
    let upperLimit = 1;
    let upperIndex = 1;
    let i;

    fraction = fraction < 0 ? 0 : fraction > 1 ? 1 : fraction;

    for (i = 0; i < fractions.length; i++) {
      if (fractions[i] < fraction && lowerLimit < fractions[i]) {
        lowerLimit = fractions[i];
        lowerIndex = i;
      }
      if (fractions[i] === fraction) {
        return colors[i]
      }
      if (fractions[i] > fraction && upperLimit >= fractions[i]) {
        upperLimit = fractions[i];
        upperIndex = i;
      }
    }
    const interpolationFraction = (fraction - lowerLimit) / (upperLimit - lowerLimit);
    return getColorFromFraction(
      colors[lowerIndex],
      colors[upperIndex],
      1,
      interpolationFraction
    )
  };

  this.getStart = function () {
    return start
  };

  this.getEnd = function () {
    return end
  };
};

function setAlpha (hex, alpha) {
  const hexColor = hex.charAt(0) === '#' ? hex.substring(1, 7) : hex;
  const red = parseInt(hexColor.substring(0, 2), 16);
  const green = parseInt(hexColor.substring(2, 4), 16);
  const blue = parseInt(hexColor.substring(4, 6), 16);
  const color = 'rgba(' + red + ',' + green + ',' + blue + ',' + alpha + ')';

  return color
}

function getColorFromFraction (
  sourceColor,
  destinationColor,
  range,
  fraction,
  returnRawData
) {
  const INT_TO_FLOAT = 1 / 255;
  const sourceRed = sourceColor.getRed();
  const sourceGreen = sourceColor.getGreen();
  const sourceBlue = sourceColor.getBlue();
  const sourceAlpha = sourceColor.getAlpha();

  const deltaRed = destinationColor.getRed() - sourceRed;
  const deltaGreen = destinationColor.getGreen() - sourceGreen;
  const deltaBlue = destinationColor.getBlue() - sourceBlue;
  const deltaAlpha =
    destinationColor.getAlpha() * INT_TO_FLOAT - sourceAlpha * INT_TO_FLOAT;

  const fractionRed = (deltaRed / range) * fraction;
  const fractionGreen = (deltaGreen / range) * fraction;
  const fractionBlue = (deltaBlue / range) * fraction;
  const fractionAlpha = (deltaAlpha / range) * fraction;

  returnRawData = returnRawData || false;
  if (returnRawData) {
    return [
      (sourceRed + fractionRed).toFixed(0),
      (sourceGreen + fractionGreen).toFixed(0),
      (sourceBlue + fractionBlue).toFixed(0),
      sourceAlpha + fractionAlpha
    ]
  } else {
    return new rgbaColor(
      (sourceRed + fractionRed).toFixed(0),
      (sourceGreen + fractionGreen).toFixed(0),
      (sourceBlue + fractionBlue).toFixed(0),
      sourceAlpha + fractionAlpha
    )
  }
}

Math.log10 = function (value) {
  return Math.log(value) / Math.LN10
};

function calcNiceNumber (range, round) {
  const exponent = Math.floor(Math.log10(range)); // exponent of range
  const fraction = range / Math.pow(10, exponent); // fractional part of range
  let niceFraction; // nice, rounded fraction

  if (round) {
    if (fraction < 1.5) {
      niceFraction = 1;
    } else if (fraction < 3) {
      niceFraction = 2;
    } else if (fraction < 7) {
      niceFraction = 5;
    } else {
      niceFraction = 10;
    }
  } else {
    if (fraction <= 1) {
      niceFraction = 1;
    } else if (fraction <= 2) {
      niceFraction = 2;
    } else if (fraction <= 5) {
      niceFraction = 5;
    } else {
      niceFraction = 10;
    }
  }
  return niceFraction * Math.pow(10, exponent)
}

function roundedRectangle (ctx, x, y, w, h, radius) {
  const r = x + w;
  const b = y + h;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(r - radius, y);
  ctx.quadraticCurveTo(r, y, r, y + radius);
  ctx.lineTo(r, y + h - radius);
  ctx.quadraticCurveTo(r, b, r - radius, b);
  ctx.lineTo(x + radius, b);
  ctx.quadraticCurveTo(x, b, x, b - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  //        ctx.stroke();
}

function createBuffer (width, height) {
  const buffer = doc.createElement('canvas');
  buffer.width = width;
  buffer.height = height;
  return buffer
}

function drawToBuffer (width, height, drawFunction) {
  const buffer = doc.createElement('canvas');
  buffer.width = width;
  buffer.height = height;
  drawFunction(buffer.getContext('2d'));
  return buffer
}

function getColorValues (color) {
  const lookupBuffer = drawToBuffer(1, 1, function (ctx) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.rect(0, 0, 1, 1);
    ctx.fill();
  });
  const colorData = lookupBuffer.getContext('2d').getImageData(0, 0, 2, 2).data;

  return [colorData[0], colorData[1], colorData[2], colorData[3]]
}

function customColorDef (color) {
  const values = getColorValues(color);
  const rgbaCol = new rgbaColor(values[0], values[1], values[2], values[3]);

  const VERY_DARK = darker$1(rgbaCol, 0.32);
  const DARK = darker$1(rgbaCol, 0.62);
  const LIGHT = lighter(rgbaCol, 0.84);
  const LIGHTER = lighter(rgbaCol, 0.94);
  const VERY_LIGHT = lighter(rgbaCol, 1);

  return new ColorDef(VERY_DARK, DARK, rgbaCol, LIGHT, LIGHTER, VERY_LIGHT)
}

function rgbToHsl (red, green, blue) {
  let hue;
  let saturation;
  let delta;

  red /= 255;
  green /= 255;
  blue /= 255;

  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;

  if (max === min) {
    hue = saturation = 0; // achromatic
  } else {
    delta = max - min;
    saturation =
      lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    switch (max) {
      case red:
        hue = (green - blue) / delta + (green < blue ? 6 : 0);
        break
      case green:
        hue = (blue - red) / delta + 2;
        break
      case blue:
        hue = (red - green) / delta + 4;
        break
    }
    hue /= 6;
  }
  return [hue, saturation, lightness]
}

function hsbToRgb (hue, saturation, brightness) {
  let r;
  let g;
  let b;
  const i = Math.floor(hue * 6);
  const f = hue * 6 - i;
  const p = brightness * (1 - saturation);
  const q = brightness * (1 - f * saturation);
  const t = brightness * (1 - (1 - f) * saturation);

  switch (i % 6) {
    case 0:
      r = brightness;
      g = t;
      b = p;
      break
    case 1:
      r = q;
      g = brightness;
      b = p;
      break
    case 2:
      r = p;
      g = brightness;
      b = t;
      break
    case 3:
      r = p;
      g = q;
      b = brightness;
      break
    case 4:
      r = t;
      g = p;
      b = brightness;
      break
    case 5:
      r = brightness;
      g = p;
      b = q;
      break
  }

  return [Math.floor(r * 255), Math.floor(g * 255), Math.floor(b * 255)]
}

function rgbToHsb (r, g, b) {
  let hue;

  r = r / 255;
  g = g / 255;
  b = b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const brightness = max;
  const delta = max - min;
  const saturation = max === 0 ? 0 : delta / max;

  if (max === min) {
    hue = 0; // achromatic
  } else {
    switch (max) {
      case r:
        hue = (g - b) / delta + (g < b ? 6 : 0);
        break
      case g:
        hue = (b - r) / delta + 2;
        break
      case b:
        hue = (r - g) / delta + 4;
        break
    }
    hue /= 6;
  }
  return [hue, saturation, brightness]
}

function range (value, limit) {
  return value < 0 ? 0 : value > limit ? limit : value
}

function darker$1 (color, fraction) {
  let red = Math.floor(color.getRed() * (1 - fraction));
  let green = Math.floor(color.getGreen() * (1 - fraction));
  let blue = Math.floor(color.getBlue() * (1 - fraction));

  red = range(red, 255);
  green = range(green, 255);
  blue = range(blue, 255);

  return new rgbaColor(red, green, blue, color.getAlpha())
}

function lighter (color, fraction) {
  let red = Math.round(color.getRed() * (1 + fraction));
  let green = Math.round(color.getGreen() * (1 + fraction));
  let blue = Math.round(color.getBlue() * (1 + fraction));

  red = range(red, 255);
  green = range(green, 255);
  blue = range(blue, 255);

  return new rgbaColor(red, green, blue, color.getAlpha())
}

function getCanvasContext (elementOrId) {
  const element =
    typeof elementOrId === 'string' || elementOrId instanceof String
      ? doc.getElementById(elementOrId)
      : elementOrId;
  return element.getContext('2d')
}

class AssertionError extends Error {
  constructor (...params) {
    super(...params);

    this.name = 'AssertionError';
  }
}

function assert (cond, textOrException = undefined) {
  if (!cond) {
    if (textOrException instanceof Error) {
      throw textOrException
    } else if (textOrException === undefined) {
      throw new AssertionError()
    } else {
      throw new AssertionError(textOrException)
    }
  }
}

const drawPointerImage = function (ctx, size, ptrType, ptrColor, lblColor) {
  let ptrBuffer;
  let ptrCtx;
  let grad;
  let radius;
  const cacheKey =
    size.toString() +
    ptrType.type +
    ptrColor.light.getHexColor() +
    ptrColor.medium.getHexColor();

  // check if we have already created and cached this buffer, if not create it
  if (!drawPointerImage.cache[cacheKey]) {
    // create a pointer buffer
    ptrBuffer = createBuffer(size, size);
    ptrCtx = ptrBuffer.getContext('2d');

    switch (ptrType.type) {
      case 'type2':
        grad = ptrCtx.createLinearGradient(
          0,
          size * 0.471962,
          0,
          size * 0.130841
        );
        grad.addColorStop(0, lblColor.getRgbaColor());
        grad.addColorStop(0.36, lblColor.getRgbaColor());
        grad.addColorStop(0.361, ptrColor.light.getRgbaColor());
        grad.addColorStop(1, ptrColor.light.getRgbaColor());
        ptrCtx.fillStyle = grad;
        ptrCtx.beginPath();
        ptrCtx.moveTo(size * 0.518691, size * 0.471962);
        ptrCtx.lineTo(size * 0.509345, size * 0.462616);
        ptrCtx.lineTo(size * 0.509345, size * 0.341121);
        ptrCtx.lineTo(size * 0.504672, size * 0.130841);
        ptrCtx.lineTo(size * 0.495327, size * 0.130841);
        ptrCtx.lineTo(size * 0.490654, size * 0.341121);
        ptrCtx.lineTo(size * 0.490654, size * 0.462616);
        ptrCtx.lineTo(size * 0.481308, size * 0.471962);
        ptrCtx.closePath();
        ptrCtx.fill();
        break

      case 'type3':
        ptrCtx.beginPath();
        ptrCtx.rect(
          size * 0.495327,
          size * 0.130841,
          size * 0.009345,
          size * 0.373831
        );
        ptrCtx.closePath();
        ptrCtx.fillStyle = ptrColor.light.getRgbaColor();
        ptrCtx.fill();
        break

      case 'type4':
        grad = ptrCtx.createLinearGradient(
          0.467289 * size,
          0,
          0.528036 * size,
          0
        );
        grad.addColorStop(0, ptrColor.dark.getRgbaColor());
        grad.addColorStop(0.51, ptrColor.dark.getRgbaColor());
        grad.addColorStop(0.52, ptrColor.light.getRgbaColor());
        grad.addColorStop(1, ptrColor.light.getRgbaColor());
        ptrCtx.fillStyle = grad;
        ptrCtx.beginPath();
        ptrCtx.moveTo(size * 0.5, size * 0.126168);
        ptrCtx.lineTo(size * 0.514018, size * 0.135514);
        ptrCtx.lineTo(size * 0.53271, size * 0.5);
        ptrCtx.lineTo(size * 0.523364, size * 0.602803);
        ptrCtx.lineTo(size * 0.476635, size * 0.602803);
        ptrCtx.lineTo(size * 0.467289, size * 0.5);
        ptrCtx.lineTo(size * 0.485981, size * 0.135514);
        ptrCtx.lineTo(size * 0.5, size * 0.126168);
        ptrCtx.closePath();
        ptrCtx.fill();
        break

      case 'type5':
        grad = ptrCtx.createLinearGradient(
          0.471962 * size,
          0,
          0.528036 * size,
          0
        );
        grad.addColorStop(0, ptrColor.light.getRgbaColor());
        grad.addColorStop(0.5, ptrColor.light.getRgbaColor());
        grad.addColorStop(0.5, ptrColor.medium.getRgbaColor());
        grad.addColorStop(1, ptrColor.medium.getRgbaColor());
        ptrCtx.fillStyle = grad;
        ptrCtx.beginPath();
        ptrCtx.moveTo(size * 0.5, size * 0.495327);
        ptrCtx.lineTo(size * 0.528037, size * 0.495327);
        ptrCtx.lineTo(size * 0.5, size * 0.149532);
        ptrCtx.lineTo(size * 0.471962, size * 0.495327);
        ptrCtx.lineTo(size * 0.5, size * 0.495327);
        ptrCtx.closePath();
        ptrCtx.fill();

        ptrCtx.lineWidth = 1;
        ptrCtx.lineCap = 'square';
        ptrCtx.lineJoin = 'miter';
        ptrCtx.strokeStyle = ptrColor.dark.getRgbaColor();
        ptrCtx.stroke();
        break

      case 'type6':
        ptrCtx.fillStyle = ptrColor.medium.getRgbaColor();
        ptrCtx.beginPath();
        ptrCtx.moveTo(size * 0.481308, size * 0.485981);
        ptrCtx.lineTo(size * 0.481308, size * 0.392523);
        ptrCtx.lineTo(size * 0.485981, size * 0.317757);
        ptrCtx.lineTo(size * 0.495327, size * 0.130841);
        ptrCtx.lineTo(size * 0.504672, size * 0.130841);
        ptrCtx.lineTo(size * 0.514018, size * 0.317757);
        ptrCtx.lineTo(size * 0.518691, size * 0.38785);
        ptrCtx.lineTo(size * 0.518691, size * 0.485981);
        ptrCtx.lineTo(size * 0.504672, size * 0.485981);
        ptrCtx.lineTo(size * 0.504672, size * 0.38785);
        ptrCtx.lineTo(size * 0.5, size * 0.317757);
        ptrCtx.lineTo(size * 0.495327, size * 0.392523);
        ptrCtx.lineTo(size * 0.495327, size * 0.485981);
        ptrCtx.lineTo(size * 0.481308, size * 0.485981);
        ptrCtx.closePath();
        ptrCtx.fill();
        break

      case 'type7':
        grad = ptrCtx.createLinearGradient(
          0.481308 * size,
          0,
          0.518691 * size,
          0
        );
        grad.addColorStop(0, ptrColor.dark.getRgbaColor());
        grad.addColorStop(1, ptrColor.medium.getRgbaColor());
        ptrCtx.fillStyle = grad;
        ptrCtx.beginPath();
        ptrCtx.moveTo(size * 0.490654, size * 0.130841);
        ptrCtx.lineTo(size * 0.481308, size * 0.5);
        ptrCtx.lineTo(size * 0.518691, size * 0.5);
        ptrCtx.lineTo(size * 0.504672, size * 0.130841);
        ptrCtx.lineTo(size * 0.490654, size * 0.130841);
        ptrCtx.closePath();
        ptrCtx.fill();
        break

      case 'type8':
        grad = ptrCtx.createLinearGradient(
          0.471962 * size,
          0,
          0.528036 * size,
          0
        );
        grad.addColorStop(0, ptrColor.light.getRgbaColor());
        grad.addColorStop(0.5, ptrColor.light.getRgbaColor());
        grad.addColorStop(0.5, ptrColor.medium.getRgbaColor());
        grad.addColorStop(1, ptrColor.medium.getRgbaColor());
        ptrCtx.fillStyle = grad;
        ptrCtx.strokeStyle = ptrColor.dark.getRgbaColor();
        ptrCtx.beginPath();
        ptrCtx.moveTo(size * 0.5, size * 0.53271);
        ptrCtx.lineTo(size * 0.53271, size * 0.5);
        ptrCtx.bezierCurveTo(
          size * 0.53271,
          size * 0.5,
          size * 0.509345,
          size * 0.457943,
          size * 0.5,
          size * 0.149532
        );
        ptrCtx.bezierCurveTo(
          size * 0.490654,
          size * 0.457943,
          size * 0.467289,
          size * 0.5,
          size * 0.467289,
          size * 0.5
        );
        ptrCtx.lineTo(size * 0.5, size * 0.53271);
        ptrCtx.closePath();
        ptrCtx.fill();
        ptrCtx.stroke();
        break

      case 'type9':
        grad = ptrCtx.createLinearGradient(
          0.471962 * size,
          0,
          0.528036 * size,
          0
        );
        grad.addColorStop(0, 'rgb(50, 50, 50)');
        grad.addColorStop(0.5, '#666666');
        grad.addColorStop(1, 'rgb(50, 50, 50)');
        ptrCtx.fillStyle = grad;
        ptrCtx.strokeStyle = '#2E2E2E';
        ptrCtx.beginPath();
        ptrCtx.moveTo(size * 0.495327, size * 0.233644);
        ptrCtx.lineTo(size * 0.504672, size * 0.233644);
        ptrCtx.lineTo(size * 0.514018, size * 0.439252);
        ptrCtx.lineTo(size * 0.485981, size * 0.439252);
        ptrCtx.lineTo(size * 0.495327, size * 0.233644);
        ptrCtx.closePath();
        ptrCtx.moveTo(size * 0.490654, size * 0.130841);
        ptrCtx.lineTo(size * 0.471962, size * 0.471962);
        ptrCtx.lineTo(size * 0.471962, size * 0.528037);
        ptrCtx.bezierCurveTo(
          size * 0.471962,
          size * 0.528037,
          size * 0.476635,
          size * 0.602803,
          size * 0.476635,
          size * 0.602803
        );
        ptrCtx.bezierCurveTo(
          size * 0.476635,
          size * 0.607476,
          size * 0.481308,
          size * 0.607476,
          size * 0.5,
          size * 0.607476
        );
        ptrCtx.bezierCurveTo(
          size * 0.518691,
          size * 0.607476,
          size * 0.523364,
          size * 0.607476,
          size * 0.523364,
          size * 0.602803
        );
        ptrCtx.bezierCurveTo(
          size * 0.523364,
          size * 0.602803,
          size * 0.528037,
          size * 0.528037,
          size * 0.528037,
          size * 0.528037
        );
        ptrCtx.lineTo(size * 0.528037, size * 0.471962);
        ptrCtx.lineTo(size * 0.509345, size * 0.130841);
        ptrCtx.lineTo(size * 0.490654, size * 0.130841);
        ptrCtx.closePath();
        ptrCtx.fill();

        ptrCtx.beginPath();
        ptrCtx.moveTo(size * 0.495327, size * 0.219626);
        ptrCtx.lineTo(size * 0.504672, size * 0.219626);
        ptrCtx.lineTo(size * 0.504672, size * 0.135514);
        ptrCtx.lineTo(size * 0.495327, size * 0.135514);
        ptrCtx.lineTo(size * 0.495327, size * 0.219626);
        ptrCtx.closePath();

        ptrCtx.fillStyle = ptrColor.medium.getRgbaColor();
        ptrCtx.fill();
        break

      case 'type10':
        // POINTER_TYPE10
        ptrCtx.beginPath();
        ptrCtx.moveTo(size * 0.5, size * 0.149532);
        ptrCtx.bezierCurveTo(
          size * 0.5,
          size * 0.149532,
          size * 0.443925,
          size * 0.490654,
          size * 0.443925,
          size * 0.5
        );
        ptrCtx.bezierCurveTo(
          size * 0.443925,
          size * 0.53271,
          size * 0.467289,
          size * 0.556074,
          size * 0.5,
          size * 0.556074
        );
        ptrCtx.bezierCurveTo(
          size * 0.53271,
          size * 0.556074,
          size * 0.556074,
          size * 0.53271,
          size * 0.556074,
          size * 0.5
        );
        ptrCtx.bezierCurveTo(
          size * 0.556074,
          size * 0.490654,
          size * 0.5,
          size * 0.149532,
          size * 0.5,
          size * 0.149532
        );
        ptrCtx.closePath();
        grad = ptrCtx.createLinearGradient(
          0.471962 * size,
          0,
          0.528036 * size,
          0
        );
        grad.addColorStop(0, ptrColor.light.getRgbaColor());
        grad.addColorStop(0.5, ptrColor.light.getRgbaColor());
        grad.addColorStop(0.5, ptrColor.medium.getRgbaColor());
        grad.addColorStop(1, ptrColor.medium.getRgbaColor());
        ptrCtx.fillStyle = grad;
        ptrCtx.strokeStyle = ptrColor.medium.getRgbaColor();
        ptrCtx.lineWidth = 1;
        ptrCtx.lineCap = 'square';
        ptrCtx.lineJoin = 'miter';
        ptrCtx.fill();
        ptrCtx.stroke();
        break

      case 'type11':
        // POINTER_TYPE11
        ptrCtx.beginPath();
        ptrCtx.moveTo(0.5 * size, 0.168224 * size);
        ptrCtx.lineTo(0.485981 * size, 0.5 * size);
        ptrCtx.bezierCurveTo(
          0.485981 * size,
          0.5 * size,
          0.481308 * size,
          0.584112 * size,
          0.5 * size,
          0.584112 * size
        );
        ptrCtx.bezierCurveTo(
          0.514018 * size,
          0.584112 * size,
          0.509345 * size,
          0.5 * size,
          0.509345 * size,
          0.5 * size
        );
        ptrCtx.lineTo(0.5 * size, 0.168224 * size);
        ptrCtx.closePath();
        grad = ptrCtx.createLinearGradient(
          0,
          0.168224 * size,
          0,
          0.584112 * size
        );
        grad.addColorStop(0, ptrColor.medium.getRgbaColor());
        grad.addColorStop(1, ptrColor.dark.getRgbaColor());
        ptrCtx.fillStyle = grad;
        ptrCtx.strokeStyle = ptrColor.dark.getRgbaColor();
        ptrCtx.fill();
        ptrCtx.stroke();
        break

      case 'type12':
        // POINTER_TYPE12
        ptrCtx.beginPath();
        ptrCtx.moveTo(0.5 * size, 0.168224 * size);
        ptrCtx.lineTo(0.485981 * size, 0.5 * size);
        ptrCtx.lineTo(0.5 * size, 0.504672 * size);
        ptrCtx.lineTo(0.509345 * size, 0.5 * size);
        ptrCtx.lineTo(0.5 * size, 0.168224 * size);
        ptrCtx.closePath();
        grad = ptrCtx.createLinearGradient(
          0,
          0.168224 * size,
          0,
          0.504672 * size
        );
        grad.addColorStop(0, ptrColor.medium.getRgbaColor());
        grad.addColorStop(1, ptrColor.dark.getRgbaColor());
        ptrCtx.fillStyle = grad;
        ptrCtx.strokeStyle = ptrColor.dark.getRgbaColor();
        ptrCtx.fill();
        ptrCtx.stroke();
        break

      case 'type13':
      // POINTER_TYPE13
      // eslint-disable-next-line no-fallthrough
      case 'type14':
        // POINTER_TYPE14 (same shape as 13)
        ptrCtx.beginPath();
        ptrCtx.moveTo(0.485981 * size, 0.168224 * size);
        ptrCtx.lineTo(0.5 * size, 0.130841 * size);
        ptrCtx.lineTo(0.509345 * size, 0.168224 * size);
        ptrCtx.lineTo(0.509345 * size, 0.509345 * size);
        ptrCtx.lineTo(0.485981 * size, 0.509345 * size);
        ptrCtx.lineTo(0.485981 * size, 0.168224 * size);
        ptrCtx.closePath();
        if (ptrType.type === 'type13') {
          // TYPE13
          grad = ptrCtx.createLinearGradient(0, 0.5 * size, 0, 0.130841 * size);
          grad.addColorStop(0, lblColor.getRgbaColor());
          grad.addColorStop(0.85, lblColor.getRgbaColor());
          grad.addColorStop(0.85, ptrColor.medium.getRgbaColor());
          grad.addColorStop(1, ptrColor.medium.getRgbaColor());
          ptrCtx.fillStyle = grad;
        } else {
          // TYPE14
          grad = ptrCtx.createLinearGradient(
            0.485981 * size,
            0,
            0.509345 * size,
            0
          );
          grad.addColorStop(0, ptrColor.veryDark.getRgbaColor());
          grad.addColorStop(0.5, ptrColor.light.getRgbaColor());
          grad.addColorStop(1, ptrColor.veryDark.getRgbaColor());
          ptrCtx.fillStyle = grad;
        }
        ptrCtx.fill();
        break

      case 'type15':
      // POINTER TYPE15 - Classic with crescent
      // eslint-disable-next-line no-fallthrough
      case 'type16':
        // POINTER TYPE16 - Classic without crescent
        ptrCtx.beginPath();
        ptrCtx.moveTo(size * 0.509345, size * 0.457943);
        ptrCtx.lineTo(size * 0.5015, size * 0.13);
        ptrCtx.lineTo(size * 0.4985, size * 0.13);
        ptrCtx.lineTo(size * 0.490654, size * 0.457943);
        ptrCtx.bezierCurveTo(
          size * 0.490654,
          size * 0.457943,
          size * 0.490654,
          size * 0.457943,
          size * 0.490654,
          size * 0.457943
        );
        ptrCtx.bezierCurveTo(
          size * 0.471962,
          size * 0.462616,
          size * 0.457943,
          size * 0.481308,
          size * 0.457943,
          size * 0.5
        );
        ptrCtx.bezierCurveTo(
          size * 0.457943,
          size * 0.518691,
          size * 0.471962,
          size * 0.537383,
          size * 0.490654,
          size * 0.542056
        );
        ptrCtx.bezierCurveTo(
          size * 0.490654,
          size * 0.542056,
          size * 0.490654,
          size * 0.542056,
          size * 0.490654,
          size * 0.542056
        );
        if (ptrType.type === 'type15') {
          ptrCtx.lineTo(size * 0.490654, size * 0.57);
          ptrCtx.bezierCurveTo(
            size * 0.46,
            size * 0.58,
            size * 0.46,
            size * 0.62,
            size * 0.490654,
            size * 0.63
          );
          ptrCtx.bezierCurveTo(
            size * 0.47,
            size * 0.62,
            size * 0.48,
            size * 0.59,
            size * 0.5,
            size * 0.59
          );
          ptrCtx.bezierCurveTo(
            size * 0.53,
            size * 0.59,
            size * 0.52,
            size * 0.62,
            size * 0.509345,
            size * 0.63
          );
          ptrCtx.bezierCurveTo(
            size * 0.54,
            size * 0.62,
            size * 0.54,
            size * 0.58,
            size * 0.509345,
            size * 0.57
          );
          ptrCtx.lineTo(size * 0.509345, size * 0.57);
        } else {
          ptrCtx.lineTo(size * 0.490654, size * 0.621495);
          ptrCtx.lineTo(size * 0.509345, size * 0.621495);
        }
        ptrCtx.lineTo(size * 0.509345, size * 0.542056);
        ptrCtx.bezierCurveTo(
          size * 0.509345,
          size * 0.542056,
          size * 0.509345,
          size * 0.542056,
          size * 0.509345,
          size * 0.542056
        );
        ptrCtx.bezierCurveTo(
          size * 0.528037,
          size * 0.537383,
          size * 0.542056,
          size * 0.518691,
          size * 0.542056,
          size * 0.5
        );
        ptrCtx.bezierCurveTo(
          size * 0.542056,
          size * 0.481308,
          size * 0.528037,
          size * 0.462616,
          size * 0.509345,
          size * 0.457943
        );
        ptrCtx.bezierCurveTo(
          size * 0.509345,
          size * 0.457943,
          size * 0.509345,
          size * 0.457943,
          size * 0.509345,
          size * 0.457943
        );
        ptrCtx.closePath();
        if (ptrType.type === 'type15') {
          grad = ptrCtx.createLinearGradient(0, 0, 0, size * 0.63);
        } else {
          grad = ptrCtx.createLinearGradient(0, 0, 0, size * 0.621495);
        }
        grad.addColorStop(0, ptrColor.medium.getRgbaColor());
        grad.addColorStop(0.388888, ptrColor.medium.getRgbaColor());
        grad.addColorStop(0.5, ptrColor.light.getRgbaColor());
        grad.addColorStop(0.611111, ptrColor.medium.getRgbaColor());
        grad.addColorStop(1, ptrColor.medium.getRgbaColor());
        ptrCtx.fillStyle = grad;
        ptrCtx.strokeStyle = ptrColor.dark.getRgbaColor();
        ptrCtx.fill();
        ptrCtx.stroke();
        // Draw the rings
        ptrCtx.beginPath();
        radius = (size * 0.06542) / 2;
        ptrCtx.arc(size * 0.5, size * 0.5, radius, 0, TWO_PI);
        grad = ptrCtx.createLinearGradient(
          size * 0.5 - radius,
          size * 0.5 + radius,
          0,
          size * 0.5 + radius
        );
        grad.addColorStop(0, '#e6b35c');
        grad.addColorStop(0.01, '#e6b35c');
        grad.addColorStop(0.99, '#c48200');
        grad.addColorStop(1, '#c48200');
        ptrCtx.fillStyle = grad;
        ptrCtx.closePath();
        ptrCtx.fill();
        ptrCtx.beginPath();
        radius = (size * 0.046728) / 2;
        ptrCtx.arc(size * 0.5, size * 0.5, radius, 0, TWO_PI);
        grad = ptrCtx.createRadialGradient(
          size * 0.5,
          size * 0.5,
          0,
          size * 0.5,
          size * 0.5,
          radius
        );
        grad.addColorStop(0, '#c5c5c5');
        grad.addColorStop(0.19, '#c5c5c5');
        grad.addColorStop(0.22, '#000000');
        grad.addColorStop(0.8, '#000000');
        grad.addColorStop(0.99, '#707070');
        grad.addColorStop(1, '#707070');
        ptrCtx.fillStyle = grad;
        ptrCtx.closePath();
        ptrCtx.fill();
        break

      case 'type1':
      /* falls through */
      default:
        grad = ptrCtx.createLinearGradient(
          0,
          size * 0.471962,
          0,
          size * 0.130841
        );
        grad.addColorStop(0, ptrColor.veryDark.getRgbaColor());
        grad.addColorStop(0.3, ptrColor.medium.getRgbaColor());
        grad.addColorStop(0.59, ptrColor.medium.getRgbaColor());
        grad.addColorStop(1, ptrColor.veryDark.getRgbaColor());
        ptrCtx.fillStyle = grad;
        ptrCtx.beginPath();
        ptrCtx.moveTo(size * 0.518691, size * 0.471962);
        ptrCtx.bezierCurveTo(
          size * 0.514018,
          size * 0.457943,
          size * 0.509345,
          size * 0.415887,
          size * 0.509345,
          size * 0.401869
        );
        ptrCtx.bezierCurveTo(
          size * 0.504672,
          size * 0.383177,
          size * 0.5,
          size * 0.130841,
          size * 0.5,
          size * 0.130841
        );
        ptrCtx.bezierCurveTo(
          size * 0.5,
          size * 0.130841,
          size * 0.490654,
          size * 0.383177,
          size * 0.490654,
          size * 0.397196
        );
        ptrCtx.bezierCurveTo(
          size * 0.490654,
          size * 0.415887,
          size * 0.485981,
          size * 0.457943,
          size * 0.481308,
          size * 0.471962
        );
        ptrCtx.bezierCurveTo(
          size * 0.471962,
          size * 0.481308,
          size * 0.467289,
          size * 0.490654,
          size * 0.467289,
          size * 0.5
        );
        ptrCtx.bezierCurveTo(
          size * 0.467289,
          size * 0.518691,
          size * 0.481308,
          size * 0.53271,
          size * 0.5,
          size * 0.53271
        );
        ptrCtx.bezierCurveTo(
          size * 0.518691,
          size * 0.53271,
          size * 0.53271,
          size * 0.518691,
          size * 0.53271,
          size * 0.5
        );
        ptrCtx.bezierCurveTo(
          size * 0.53271,
          size * 0.490654,
          size * 0.528037,
          size * 0.481308,
          size * 0.518691,
          size * 0.471962
        );
        ptrCtx.closePath();
        ptrCtx.fill();
        break
    }
    // cache buffer
    drawPointerImage.cache[cacheKey] = ptrBuffer;
  }
  ctx.drawImage(drawPointerImage.cache[cacheKey], 0, 0);
  return this
};
drawPointerImage.cache = {};

const drawFrame = function (
  ctx,
  frameDesign,
  centerX,
  centerY,
  imageWidth,
  imageHeight
) {
  let radFBuffer;
  let radFCtx;
  let grad;
  let outerX;
  let innerX;
  let fractions;
  let colors;
  const cacheKey = imageWidth.toString() + imageHeight + frameDesign.design;

  // check if we have already created and cached this buffer, if not create it
  if (!drawFrame.cache[cacheKey]) {
    // Setup buffer
    radFBuffer = createBuffer(imageWidth, imageHeight);
    radFCtx = radFBuffer.getContext('2d');

    // outer gray frame
    radFCtx.fillStyle = '#848484';
    radFCtx.strokeStyle = 'rgba(132, 132, 132, 0.5)';
    radFCtx.beginPath();
    radFCtx.arc(centerX, centerY, imageWidth / 2, 0, TWO_PI, true);
    radFCtx.closePath();
    radFCtx.fill();
    radFCtx.stroke();

    radFCtx.beginPath();
    radFCtx.arc(centerX, centerY, (imageWidth * 0.990654) / 2, 0, TWO_PI, true);
    radFCtx.closePath();

    // main gradient frame
    switch (frameDesign.design) {
      case 'metal':
        grad = radFCtx.createLinearGradient(
          0,
          imageWidth * 0.004672,
          0,
          imageHeight * 0.990654
        );
        grad.addColorStop(0, '#fefefe');
        grad.addColorStop(0.07, 'rgb(210, 210, 210)');
        grad.addColorStop(0.12, 'rgb(179, 179, 179)');
        grad.addColorStop(1, 'rgb(213, 213, 213)');
        radFCtx.fillStyle = grad;
        radFCtx.fill();
        break

      case 'brass':
        grad = radFCtx.createLinearGradient(
          0,
          imageWidth * 0.004672,
          0,
          imageHeight * 0.990654
        );
        grad.addColorStop(0, 'rgb(249, 243, 155)');
        grad.addColorStop(0.05, 'rgb(246, 226, 101)');
        grad.addColorStop(0.1, 'rgb(240, 225, 132)');
        grad.addColorStop(0.5, 'rgb(90, 57, 22)');
        grad.addColorStop(0.9, 'rgb(249, 237, 139)');
        grad.addColorStop(0.95, 'rgb(243, 226, 108)');
        grad.addColorStop(1, 'rgb(202, 182, 113)');
        radFCtx.fillStyle = grad;
        radFCtx.fill();
        break

      case 'steel':
        grad = radFCtx.createLinearGradient(
          0,
          imageWidth * 0.004672,
          0,
          imageHeight * 0.990654
        );
        grad.addColorStop(0, 'rgb(231, 237, 237)');
        grad.addColorStop(0.05, 'rgb(189, 199, 198)');
        grad.addColorStop(0.1, 'rgb(192, 201, 200)');
        grad.addColorStop(0.5, 'rgb(23, 31, 33)');
        grad.addColorStop(0.9, 'rgb(196, 205, 204)');
        grad.addColorStop(0.95, 'rgb(194, 204, 203)');
        grad.addColorStop(1, 'rgb(189, 201, 199)');
        radFCtx.fillStyle = grad;
        radFCtx.fill();
        break

      case 'gold':
        grad = radFCtx.createLinearGradient(
          0,
          imageWidth * 0.004672,
          0,
          imageHeight * 0.990654
        );
        grad.addColorStop(0, 'rgb(255, 255, 207)');
        grad.addColorStop(0.15, 'rgb(255, 237, 96)');
        grad.addColorStop(0.22, 'rgb(254, 199, 57)');
        grad.addColorStop(0.3, 'rgb(255, 249, 203)');
        grad.addColorStop(0.38, 'rgb(255, 199, 64)');
        grad.addColorStop(0.44, 'rgb(252, 194, 60)');
        grad.addColorStop(0.51, 'rgb(255, 204, 59)');
        grad.addColorStop(0.6, 'rgb(213, 134, 29)');
        grad.addColorStop(0.68, 'rgb(255, 201, 56)');
        grad.addColorStop(0.75, 'rgb(212, 135, 29)');
        grad.addColorStop(1, 'rgb(247, 238, 101)');
        radFCtx.fillStyle = grad;
        radFCtx.fill();
        break

      case 'anthracite':
        grad = radFCtx.createLinearGradient(
          0,
          0.004672 * imageHeight,
          0,
          0.995326 * imageHeight
        );
        grad.addColorStop(0, 'rgb(118, 117, 135)');
        grad.addColorStop(0.06, 'rgb(74, 74, 82)');
        grad.addColorStop(0.12, 'rgb(50, 50, 54)');
        grad.addColorStop(1, 'rgb(79, 79, 87)');
        radFCtx.fillStyle = grad;
        radFCtx.fill();
        break

      case 'tiltedGray':
        grad = radFCtx.createLinearGradient(
          0.233644 * imageWidth,
          0.084112 * imageHeight,
          0.81258 * imageWidth,
          0.910919 * imageHeight
        );
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.07, 'rgb(210, 210, 210)');
        grad.addColorStop(0.16, 'rgb(179, 179, 179)');
        grad.addColorStop(0.33, '#ffffff');
        grad.addColorStop(0.55, '#c5c5c5');
        grad.addColorStop(0.79, '#ffffff');
        grad.addColorStop(1, '#666666');
        radFCtx.fillStyle = grad;
        radFCtx.fill();
        break

      case 'tiltedBlack':
        grad = radFCtx.createLinearGradient(
          0.228971 * imageWidth,
          0.079439 * imageHeight,
          0.802547 * imageWidth,
          0.898591 * imageHeight
        );
        grad.addColorStop(0, '#666666');
        grad.addColorStop(0.21, '#000000');
        grad.addColorStop(0.47, '#666666');
        grad.addColorStop(0.99, '#000000');
        grad.addColorStop(1, '#000000');
        radFCtx.fillStyle = grad;
        radFCtx.fill();
        break

      case 'glossyMetal':
        grad = radFCtx.createRadialGradient(
          0.5 * imageWidth,
          0.5 * imageHeight,
          0,
          0.5 * imageWidth,
          0.5 * imageWidth,
          0.5 * imageWidth
        );
        grad.addColorStop(0, 'rgb(207, 207, 207)');
        grad.addColorStop(0.96, 'rgb(205, 204, 205)');
        grad.addColorStop(1, 'rgb(244, 244, 244)');
        radFCtx.fillStyle = grad;
        radFCtx.fill();
        radFCtx.beginPath();
        radFCtx.arc(
          0.5 * imageWidth,
          0.5 * imageHeight,
          (0.973962 * imageWidth) / 2,
          0,
          TWO_PI
        );
        radFCtx.closePath();
        grad = radFCtx.createLinearGradient(
          0,
          imageHeight - 0.971962 * imageHeight,
          0,
          0.971962 * imageHeight
        );
        grad.addColorStop(0, 'rgb(249, 249, 249)');
        grad.addColorStop(0.23, 'rgb(200, 195, 191)');
        grad.addColorStop(0.36, '#ffffff');
        grad.addColorStop(0.59, 'rgb(29, 29, 29)');
        grad.addColorStop(0.76, 'rgb(200, 194, 192)');
        grad.addColorStop(1, 'rgb(209, 209, 209)');
        radFCtx.fillStyle = grad;
        radFCtx.fill();

        radFCtx.beginPath();
        radFCtx.arc(
          0.5 * imageWidth,
          0.5 * imageHeight,
          (0.869158 * imageWidth) / 2,
          0,
          TWO_PI
        );
        radFCtx.closePath();
        radFCtx.fillStyle = '#f6f6f6';
        radFCtx.fill();

        radFCtx.beginPath();
        radFCtx.arc(
          0.5 * imageWidth,
          0.5 * imageHeight,
          (0.85 * imageWidth) / 2,
          0,
          TWO_PI
        );
        radFCtx.closePath();
        radFCtx.fillStyle = '#333333';
        radFCtx.fill();
        break

      case 'blackMetal':
        fractions = [0, 0.125, 0.347222, 0.5, 0.680555, 0.875, 1];

        colors = [
          new rgbaColor(254, 254, 254, 1),
          new rgbaColor(0, 0, 0, 1),
          new rgbaColor(153, 153, 153, 1),
          new rgbaColor(0, 0, 0, 1),
          new rgbaColor(153, 153, 153, 1),
          new rgbaColor(0, 0, 0, 1),
          new rgbaColor(254, 254, 254, 1)
        ];

        radFCtx.save();
        radFCtx.arc(
          centerX,
          centerY,
          (imageWidth * 0.990654) / 2,
          0,
          TWO_PI,
          true
        );
        radFCtx.clip();
        outerX = imageWidth * 0.495327;
        innerX = imageWidth * 0.42056;
        grad = new ConicalGradient(fractions, colors);
        grad.fillCircle(radFCtx, centerX, centerY, innerX, outerX);
        // fade outer edge
        radFCtx.strokeStyle = '#848484';
        radFCtx.strokeStyle = 'rgba(132, 132, 132, 0.8)';
        radFCtx.beginPath();
        radFCtx.lineWidth = imageWidth / 90;
        radFCtx.arc(centerX, centerY, imageWidth / 2, 0, TWO_PI, true);
        radFCtx.closePath();
        radFCtx.stroke();
        radFCtx.restore();
        break

      case 'shinyMetal':
        fractions = [0, 0.125, 0.25, 0.347222, 0.5, 0.652777, 0.75, 0.875, 1];

        colors = [
          new rgbaColor(254, 254, 254, 1),
          new rgbaColor(210, 210, 210, 1),
          new rgbaColor(179, 179, 179, 1),
          new rgbaColor(238, 238, 238, 1),
          new rgbaColor(160, 160, 160, 1),
          new rgbaColor(238, 238, 238, 1),
          new rgbaColor(179, 179, 179, 1),
          new rgbaColor(210, 210, 210, 1),
          new rgbaColor(254, 254, 254, 1)
        ];

        radFCtx.save();
        radFCtx.arc(
          centerX,
          centerY,
          (imageWidth * 0.990654) / 2,
          0,
          TWO_PI,
          true
        );
        radFCtx.clip();
        outerX = imageWidth * 0.495327;
        innerX = imageWidth * 0.42056;
        grad = new ConicalGradient(fractions, colors);
        grad.fillCircle(radFCtx, centerX, centerY, innerX, outerX);
        // fade outer edge
        radFCtx.strokeStyle = '#848484';
        radFCtx.strokeStyle = 'rgba(132, 132, 132, 0.8)';
        radFCtx.beginPath();
        radFCtx.lineWidth = imageWidth / 90;
        radFCtx.arc(centerX, centerY, imageWidth / 2, 0, TWO_PI, true);
        radFCtx.closePath();
        radFCtx.stroke();
        radFCtx.restore();
        break

      case 'chrome':
        fractions = [
          0,
          0.09,
          0.12,
          0.16,
          0.25,
          0.29,
          0.33,
          0.38,
          0.48,
          0.52,
          0.63,
          0.68,
          0.8,
          0.83,
          0.87,
          0.97,
          1
        ];

        colors = [
          new rgbaColor(255, 255, 255, 1),
          new rgbaColor(255, 255, 255, 1),
          new rgbaColor(136, 136, 138, 1),
          new rgbaColor(164, 185, 190, 1),
          new rgbaColor(158, 179, 182, 1),
          new rgbaColor(112, 112, 112, 1),
          new rgbaColor(221, 227, 227, 1),
          new rgbaColor(155, 176, 179, 1),
          new rgbaColor(156, 176, 177, 1),
          new rgbaColor(254, 255, 255, 1),
          new rgbaColor(255, 255, 255, 1),
          new rgbaColor(156, 180, 180, 1),
          new rgbaColor(198, 209, 211, 1),
          new rgbaColor(246, 248, 247, 1),
          new rgbaColor(204, 216, 216, 1),
          new rgbaColor(164, 188, 190, 1),
          new rgbaColor(255, 255, 255, 1)
        ];

        radFCtx.save();
        radFCtx.arc(
          centerX,
          centerY,
          (imageWidth * 0.990654) / 2,
          0,
          TWO_PI,
          true
        );
        radFCtx.clip();
        outerX = imageWidth * 0.495327;
        innerX = imageWidth * 0.42056;
        grad = new ConicalGradient(fractions, colors);
        grad.fillCircle(radFCtx, centerX, centerY, innerX, outerX);
        // fade outer edge
        radFCtx.strokeStyle = '#848484';
        radFCtx.strokeStyle = 'rgba(132, 132, 132, 0.8)';
        radFCtx.beginPath();
        radFCtx.lineWidth = imageWidth / 90;
        radFCtx.arc(centerX, centerY, imageWidth / 2, 0, TWO_PI, true);
        radFCtx.closePath();
        radFCtx.stroke();
        radFCtx.restore();

        break
    }

    // inner bright frame
    radFCtx.fillStyle = 'rgb(191, 191, 191)';
    radFCtx.beginPath();
    radFCtx.arc(centerX, centerY, (imageWidth * 0.841121) / 2, 0, TWO_PI, true);
    radFCtx.closePath();
    radFCtx.fill();

    // clip out center so it is transparent if the background is not visible
    radFCtx.globalCompositeOperation = 'destination-out';
    // Background ellipse
    radFCtx.beginPath();
    radFCtx.arc(centerX, centerY, (imageWidth * 0.83) / 2, 0, TWO_PI, true);
    radFCtx.closePath();
    radFCtx.fill();

    // cache the buffer
    drawFrame.cache[cacheKey] = radFBuffer;
  }
  ctx.drawImage(drawFrame.cache[cacheKey], 0, 0);
  return this
};
drawFrame.cache = {};

const carbonBuffer = drawToBuffer(12, 12, function (ctx) {
  const imageWidth = ctx.canvas.width;
  const imageHeight = ctx.canvas.height;
  let offsetY = 0;
  let grad;

  ctx.save();

  // RULB
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, imageWidth * 0.5, imageHeight * 0.5);
  ctx.closePath();
  ctx.restore();

  grad = ctx.createLinearGradient(
    0,
    offsetY * imageHeight,
    0,
    0.5 * imageHeight + offsetY * imageHeight
  );
  grad.addColorStop(0, 'rgb(35, 35, 35)');
  grad.addColorStop(1, 'rgb(23, 23, 23)');
  ctx.fillStyle = grad;
  ctx.fill();

  // RULF
  ctx.save();
  ctx.beginPath();
  ctx.rect(
    imageWidth * 0.083333,
    0,
    imageWidth * 0.333333,
    imageHeight * 0.416666
  );
  ctx.closePath();
  ctx.restore();
  offsetY = 0;
  grad = ctx.createLinearGradient(
    0,
    offsetY * imageHeight,
    0,
    0.416666 * imageHeight + offsetY * imageHeight
  );
  grad.addColorStop(0, 'rgb(38, 38, 38)');
  grad.addColorStop(1, 'rgb(30, 30, 30)');
  ctx.fillStyle = grad;
  ctx.fill();

  // RLRB
  ctx.save();
  ctx.beginPath();
  ctx.rect(
    imageWidth * 0.5,
    imageHeight * 0.5,
    imageWidth * 0.5,
    imageHeight * 0.5
  );
  ctx.closePath();
  ctx.restore();
  offsetY = 0.5;
  grad = ctx.createLinearGradient(
    0,
    offsetY * imageHeight,
    0,
    0.5 * imageHeight + offsetY * imageHeight
  );
  grad.addColorStop(0, 'rgb(35, 35, 35)');
  grad.addColorStop(1, 'rgb(23, 23, 23)');
  ctx.fillStyle = grad;
  ctx.fill();

  // RLRF
  ctx.save();
  ctx.beginPath();
  ctx.rect(
    imageWidth * 0.583333,
    imageHeight * 0.5,
    imageWidth * 0.333333,
    imageHeight * 0.416666
  );
  ctx.closePath();
  ctx.restore();
  offsetY = 0.5;
  grad = ctx.createLinearGradient(
    0,
    offsetY * imageHeight,
    0,
    0.416666 * imageHeight + offsetY * imageHeight
  );
  grad.addColorStop(0, 'rgb(38, 38, 38)');
  grad.addColorStop(1, 'rgb(30, 30, 30)');
  ctx.fillStyle = grad;
  ctx.fill();

  // RURB
  ctx.save();
  ctx.beginPath();
  ctx.rect(imageWidth * 0.5, 0, imageWidth * 0.5, imageHeight * 0.5);
  ctx.closePath();
  ctx.restore();
  offsetY = 0;
  grad = ctx.createLinearGradient(
    0,
    offsetY * imageHeight,
    0,
    0.5 * imageHeight + offsetY * imageHeight
  );
  grad.addColorStop(0, '#303030');
  grad.addColorStop(1, 'rgb(40, 40, 40)');
  ctx.fillStyle = grad;
  ctx.fill();

  // RURF
  ctx.save();
  ctx.beginPath();
  ctx.rect(
    imageWidth * 0.583333,
    imageHeight * 0.083333,
    imageWidth * 0.333333,
    imageHeight * 0.416666
  );
  ctx.closePath();
  ctx.restore();
  offsetY = 0.083333;
  grad = ctx.createLinearGradient(
    0,
    offsetY * imageHeight,
    0,
    0.416666 * imageHeight + offsetY * imageHeight
  );
  grad.addColorStop(0, 'rgb(53, 53, 53)');
  grad.addColorStop(1, 'rgb(45, 45, 45)');
  ctx.fillStyle = grad;
  ctx.fill();

  // RLLB
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, imageHeight * 0.5, imageWidth * 0.5, imageHeight * 0.5);
  ctx.closePath();
  ctx.restore();
  offsetY = 0.5;
  grad = ctx.createLinearGradient(
    0,
    offsetY * imageHeight,
    0,
    0.5 * imageHeight + offsetY * imageHeight
  );
  grad.addColorStop(0, '#303030');
  grad.addColorStop(1, '#282828');
  ctx.fillStyle = grad;
  ctx.fill();

  // RLLF
  ctx.save();
  ctx.beginPath();
  ctx.rect(
    imageWidth * 0.083333,
    imageHeight * 0.583333,
    imageWidth * 0.333333,
    imageHeight * 0.416666
  );
  ctx.closePath();
  ctx.restore();
  offsetY = 0.583333;
  grad = ctx.createLinearGradient(
    0,
    offsetY * imageHeight,
    0,
    0.416666 * imageHeight + offsetY * imageHeight
  );
  grad.addColorStop(0, '#353535');
  grad.addColorStop(1, '#2d2d2d');
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.restore();
});

const punchedSheetBuffer = drawToBuffer(15, 15, function (ctx) {
  const imageWidth = ctx.canvas.width;
  const imageHeight = ctx.canvas.height;
  let grad;

  ctx.save();

  // BACK
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, imageWidth, imageHeight);
  ctx.closePath();
  ctx.restore();
  ctx.fillStyle = '#1D2123';
  ctx.fill();

  // ULB
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, imageHeight * 0.266666);
  ctx.bezierCurveTo(
    0,
    imageHeight * 0.4,
    imageWidth * 0.066666,
    imageHeight * 0.466666,
    imageWidth * 0.2,
    imageHeight * 0.466666
  );
  ctx.bezierCurveTo(
    imageWidth * 0.333333,
    imageHeight * 0.466666,
    imageWidth * 0.4,
    imageHeight * 0.4,
    imageWidth * 0.4,
    imageHeight * 0.266666
  );
  ctx.bezierCurveTo(
    imageWidth * 0.4,
    imageHeight * 0.133333,
    imageWidth * 0.333333,
    imageHeight * 0.066666,
    imageWidth * 0.2,
    imageHeight * 0.066666
  );
  ctx.bezierCurveTo(
    imageWidth * 0.066666,
    imageHeight * 0.066666,
    0,
    imageHeight * 0.133333,
    0,
    imageHeight * 0.266666
  );
  ctx.closePath();
  grad = ctx.createLinearGradient(
    0,
    0.066666 * imageHeight,
    0,
    0.466666 * imageHeight
  );
  grad.addColorStop(0, '#000000');
  grad.addColorStop(1, '#444444');
  ctx.fillStyle = grad;
  ctx.fill();

  // ULF
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, imageHeight * 0.2);
  ctx.bezierCurveTo(
    0,
    imageHeight * 0.333333,
    imageWidth * 0.066666,
    imageHeight * 0.4,
    imageWidth * 0.2,
    imageHeight * 0.4
  );
  ctx.bezierCurveTo(
    imageWidth * 0.333333,
    imageHeight * 0.4,
    imageWidth * 0.4,
    imageHeight * 0.333333,
    imageWidth * 0.4,
    imageHeight * 0.2
  );
  ctx.bezierCurveTo(
    imageWidth * 0.4,
    imageHeight * 0.066666,
    imageWidth * 0.333333,
    0,
    imageWidth * 0.2,
    0
  );
  ctx.bezierCurveTo(
    imageWidth * 0.066666,
    0,
    0,
    imageHeight * 0.066666,
    0,
    imageHeight * 0.2
  );
  ctx.closePath();
  ctx.fillStyle = '#050506';
  ctx.fill();

  // LRB
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(imageWidth * 0.466666, imageHeight * 0.733333);
  ctx.bezierCurveTo(
    imageWidth * 0.466666,
    imageHeight * 0.866666,
    imageWidth * 0.533333,
    imageHeight * 0.933333,
    imageWidth * 0.666666,
    imageHeight * 0.933333
  );
  ctx.bezierCurveTo(
    imageWidth * 0.8,
    imageHeight * 0.933333,
    imageWidth * 0.866666,
    imageHeight * 0.866666,
    imageWidth * 0.866666,
    imageHeight * 0.733333
  );
  ctx.bezierCurveTo(
    imageWidth * 0.866666,
    imageHeight * 0.6,
    imageWidth * 0.8,
    imageHeight * 0.533333,
    imageWidth * 0.666666,
    imageHeight * 0.533333
  );
  ctx.bezierCurveTo(
    imageWidth * 0.533333,
    imageHeight * 0.533333,
    imageWidth * 0.466666,
    imageHeight * 0.6,
    imageWidth * 0.466666,
    imageHeight * 0.733333
  );
  ctx.closePath();
  grad = ctx.createLinearGradient(
    0,
    0.533333 * imageHeight,
    0,
    0.933333 * imageHeight
  );
  grad.addColorStop(0, '#000000');
  grad.addColorStop(1, '#444444');
  ctx.fillStyle = grad;
  ctx.fill();

  // LRF
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(imageWidth * 0.466666, imageHeight * 0.666666);
  ctx.bezierCurveTo(
    imageWidth * 0.466666,
    imageHeight * 0.8,
    imageWidth * 0.533333,
    imageHeight * 0.866666,
    imageWidth * 0.666666,
    imageHeight * 0.866666
  );
  ctx.bezierCurveTo(
    imageWidth * 0.8,
    imageHeight * 0.866666,
    imageWidth * 0.866666,
    imageHeight * 0.8,
    imageWidth * 0.866666,
    imageHeight * 0.666666
  );
  ctx.bezierCurveTo(
    imageWidth * 0.866666,
    imageHeight * 0.533333,
    imageWidth * 0.8,
    imageHeight * 0.466666,
    imageWidth * 0.666666,
    imageHeight * 0.466666
  );
  ctx.bezierCurveTo(
    imageWidth * 0.533333,
    imageHeight * 0.466666,
    imageWidth * 0.466666,
    imageHeight * 0.533333,
    imageWidth * 0.466666,
    imageHeight * 0.666666
  );
  ctx.closePath();
  ctx.fillStyle = '#050506';
  ctx.fill();

  ctx.restore();
});

const brushedMetalTexture = function (color, radius, amount, monochrome, shine) {
  this.fill = function (startX, startY, endX, endY) {
    let i;
    let x;
    let y; // loop counters
    let sinArr;
    // alpha = color & 0xff000000;
    const alpha = 255;
    const red = (color >> 16) & 0xff;
    const green = (color >> 8) & 0xff;
    const blue = color & 0xff;
    let n = 0;
    const variation = 255 * amount;
    let indx;
    let tr;
    let tg;
    let tb;
    let f;

    startX = Math.floor(startX);
    startY = Math.floor(startY);
    endX = Math.ceil(endX);
    endY = Math.ceil(endY);

    const width = endX - startX;
    const height = endY - startY;

    // Create output canvas
    const outCanvas = createBuffer(width, height);
    const outCanvasContext = outCanvas.getContext('2d');

    // Create pixel arrays
    const inPixels = outCanvasContext.createImageData(width, height);
    const outPixels = outCanvasContext.createImageData(width, height);

    // Precreate sin() values
    if (shine !== 0) {
      sinArr = [];
      for (i = 0; i < width; i++) {
        sinArr[i] = (255 * shine * Math.sin((i / width) * PI)) | 0;
      }
    }

    for (y = 0; y < height; y++) {
      for (x = 0; x < width; x++) {
        indx = y * width * 4 + x * 4;
        tr = red;
        tg = green;
        tb = blue;
        if (shine !== 0) {
          f = sinArr[x];
          tr += f;
          tg += f;
          tb += f;
        }

        if (monochrome) {
          n = ((2 * Math.random() - 1) * variation) | 0;
          inPixels.data[indx] = clamp(tr + n);
          inPixels.data[indx + 1] = clamp(tg + n);
          inPixels.data[indx + 2] = clamp(tb + n);
          inPixels.data[indx + 3] = alpha;
        } else {
          inPixels.data[indx] = random(tr, variation);
          inPixels.data[indx + 1] = random(tg, variation);
          inPixels.data[indx + 2] = random(tb, variation);
          inPixels.data[indx + 3] = alpha;
        }
      }
    }

    if (radius > 0) {
      horizontalBlur(inPixels, outPixels, width, height, radius, alpha);
      outCanvasContext.putImageData(outPixels, startX, startY);
    } else {
      outCanvasContext.putImageData(inPixels, startX, startY);
    }
    return outCanvas
  };

  function random (x, vari) {
    x += ((2 * Math.random() - 1) * vari) | 0;
    return x < 0 ? 0 : x > 255 ? 255 : x
  }

  function clamp (C) {
    return C < 0 ? 0 : C > 255 ? 255 : C
  }

  function horizontalBlur (inPix, outPix, width, height, radius, alpha) {
    let x;
    let y; // loop counters
    let i;
    let indx;
    let totR;
    let totG;
    let totB;

    if (radius >= width) {
      radius = width - 1;
    }
    const mul = 1 / (radius * 2 + 1);
    indx = 0;
    for (y = 0; y < height; y++) {
      totR = totG = totB = 0;
      for (x = 0; x < radius; x++) {
        i = (indx + x) * 4;
        totR += inPix.data[i];
        totG += inPix.data[i + 1];
        totB += inPix.data[i + 2];
      }
      for (x = 0; x < width; x++) {
        if (x > radius) {
          i = (indx - radius - 1) * 4;
          totR -= inPix.data[i];
          totG -= inPix.data[i + 1];
          totB -= inPix.data[i + 2];
        }
        if (x + radius < width) {
          i = (indx + radius) * 4;
          totR += inPix.data[i];
          totG += inPix.data[i + 1];
          totB += inPix.data[i + 2];
        }
        i = indx * 4;
        outPix.data[i] = (totR * mul) | 0;
        outPix.data[i + 1] = (totG * mul) | 0;
        outPix.data[i + 2] = (totB * mul) | 0;
        outPix.data[i + 3] = alpha;
        indx++;
      }
    }
  }

  return this
};

const drawBackground = function (
  ctx,
  backgroundColor,
  centerX,
  centerY,
  imageWidth,
  imageHeight
) {
  let radBBuffer;
  let radBCtx;
  let grad;
  let fractions;
  let colors;
  const backgroundOffsetX = (imageWidth * 0.831775) / 2;
  let mono;
  let textureColor;
  let texture;
  let radius;
  let turnRadius;
  let stepSize;
  let end;
  let i;
  const cacheKey = imageWidth.toString() + imageHeight + backgroundColor.name;

  // check if we have already created and cached this buffer, if not create it
  if (!drawBackground.cache[cacheKey]) {
    // Setup buffer
    radBBuffer = createBuffer(imageWidth, imageHeight);
    radBCtx = radBBuffer.getContext('2d');

    // Background ellipse
    radBCtx.beginPath();
    radBCtx.arc(centerX, centerY, backgroundOffsetX, 0, TWO_PI, true);
    radBCtx.closePath();

    // If the backgroundColor is a texture fill it with the texture instead of the gradient
    if (
      backgroundColor.name === 'CARBON' ||
      backgroundColor.name === 'PUNCHED_SHEET' ||
      backgroundColor.name === 'BRUSHED_METAL' ||
      backgroundColor.name === 'BRUSHED_STAINLESS'
    ) {
      if (backgroundColor.name === 'CARBON') {
        radBCtx.fillStyle = radBCtx.createPattern(carbonBuffer, 'repeat');
        radBCtx.fill();
      }

      if (backgroundColor.name === 'PUNCHED_SHEET') {
        radBCtx.fillStyle = radBCtx.createPattern(punchedSheetBuffer, 'repeat');
        radBCtx.fill();
      }

      // Add another inner shadow to make the look more realistic
      grad = radBCtx.createLinearGradient(
        backgroundOffsetX,
        0,
        imageWidth - backgroundOffsetX,
        0
      );
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.25)');
      grad.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
      radBCtx.fillStyle = grad;
      radBCtx.beginPath();
      radBCtx.arc(centerX, centerY, backgroundOffsetX, 0, TWO_PI, true);
      radBCtx.closePath();
      radBCtx.fill();

      if (
        backgroundColor.name === 'BRUSHED_METAL' ||
        backgroundColor.name === 'BRUSHED_STAINLESS'
      ) {
        mono = backgroundColor.name === 'BRUSHED_METAL';
        textureColor = parseInt(
          backgroundColor.gradientStop.getHexColor().substr(-6),
          16
        );
        texture = brushedMetalTexture(textureColor, 5, 0.1, mono, 0.5);
        radBCtx.fillStyle = radBCtx.createPattern(
          texture.fill(0, 0, imageWidth, imageHeight),
          'no-repeat'
        );
        radBCtx.fill();
      }
    } else if (
      backgroundColor.name === 'STAINLESS' ||
      backgroundColor.name === 'TURNED'
    ) {
      // Define the fractions of the conical gradient paint
      fractions = [
        0,
        0.03,
        0.1,
        0.14,
        0.24,
        0.33,
        0.38,
        0.5,
        0.62,
        0.67,
        0.76,
        0.81,
        0.85,
        0.97,
        1
      ];

      // Define the colors of the conical gradient paint
      colors = [
        new rgbaColor('#FDFDFD'),
        new rgbaColor('#FDFDFD'),
        new rgbaColor('#B2B2B4'),
        new rgbaColor('#ACACAE'),
        new rgbaColor('#FDFDFD'),
        new rgbaColor('#8E8E8E'),
        new rgbaColor('#8E8E8E'),
        new rgbaColor('#FDFDFD'),
        new rgbaColor('#8E8E8E'),
        new rgbaColor('#8E8E8E'),
        new rgbaColor('#FDFDFD'),
        new rgbaColor('#ACACAE'),
        new rgbaColor('#B2B2B4'),
        new rgbaColor('#FDFDFD'),
        new rgbaColor('#FDFDFD')
      ];

      grad = new ConicalGradient(fractions, colors);
      grad.fillCircle(radBCtx, centerX, centerY, 0, backgroundOffsetX);

      if (backgroundColor.name === 'TURNED') {
        // Define the turning radius
        radius = backgroundOffsetX;
        turnRadius = radius * 0.55;
        // Step size proporational to radius
        stepSize = RAD_FACTOR * (500 / radius);
        // Save before we start
        radBCtx.save();
        // restrict the turnings to the desired area
        radBCtx.beginPath();
        radBCtx.arc(centerX, centerY, radius, 0, TWO_PI);
        radBCtx.closePath();
        radBCtx.clip();
        // set the style for the turnings
        radBCtx.lineWidth = 0.5;
        end = TWO_PI - stepSize * 0.3;
        // Step the engine round'n'round
        for (i = 0; i < end; i += stepSize) {
          // draw a 'turn'
          radBCtx.strokeStyle = 'rgba(240, 240, 255, 0.25)';
          radBCtx.beginPath();
          radBCtx.arc(centerX + turnRadius, centerY, turnRadius, 0, TWO_PI);
          radBCtx.stroke();
          // rotate the 'piece' a fraction to draw 'shadow'
          radBCtx.translate(centerX, centerY);
          radBCtx.rotate(stepSize * 0.3);
          radBCtx.translate(-centerX, -centerY);
          // draw a 'turn'
          radBCtx.strokeStyle = 'rgba(25, 10, 10, 0.1)';
          radBCtx.beginPath();
          radBCtx.arc(centerX + turnRadius, centerY, turnRadius, 0, TWO_PI);
          radBCtx.stroke();
          // now rotate on to the next 'scribe' position minus the 'fraction'
          radBCtx.translate(centerX, centerY);
          radBCtx.rotate(stepSize - stepSize * 0.3);
          radBCtx.translate(-centerX, -centerY);
        }
        // Restore canvas now we are done
        radBCtx.restore();
      }
    } else {
      grad = radBCtx.createLinearGradient(
        0,
        imageWidth * 0.084112,
        0,
        backgroundOffsetX * 2
      );
      grad.addColorStop(0, backgroundColor.gradientStart.getRgbaColor());
      grad.addColorStop(0.4, backgroundColor.gradientFraction.getRgbaColor());
      grad.addColorStop(1, backgroundColor.gradientStop.getRgbaColor());
      radBCtx.fillStyle = grad;
      radBCtx.fill();
    }
    // Inner shadow
    grad = radBCtx.createRadialGradient(
      centerX,
      centerY,
      0,
      centerX,
      centerY,
      backgroundOffsetX
    );
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(0.71, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(0.86, 'rgba(0, 0, 0, 0.03)');
    grad.addColorStop(0.92, 'rgba(0, 0, 0, 0.07)');
    grad.addColorStop(0.97, 'rgba(0, 0, 0, 0.15)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
    radBCtx.fillStyle = grad;

    radBCtx.beginPath();
    radBCtx.arc(centerX, centerY, backgroundOffsetX, 0, TWO_PI, true);
    radBCtx.closePath();
    radBCtx.fill();

    // cache the buffer
    drawBackground.cache[cacheKey] = radBBuffer;
  }
  ctx.drawImage(drawBackground.cache[cacheKey], 0, 0);
  return this
};
drawBackground.cache = {};

const drawRadialCustomImage = function (
  ctx,
  img,
  centerX,
  centerY,
  imageWidth,
  imageHeight
) {
  const drawWidth = imageWidth * 0.831775;
  const drawHeight = imageHeight * 0.831775;
  const x = (imageWidth - drawWidth) / 2;
  const y = (imageHeight - drawHeight) / 2;

  if (img !== null && img.height > 0 && img.width > 0) {
    ctx.save();
    // Set the clipping area
    ctx.beginPath();
    ctx.arc(centerX, centerY, (imageWidth * 0.831775) / 2, 0, TWO_PI, true);
    ctx.clip();
    // Add the image
    ctx.drawImage(img, x, y, drawWidth, drawHeight);
    ctx.restore();
  }
  return this
};

const createKnobImage = function (size, knob, style) {
  let knobBuffer;
  let knobCtx;
  const maxPostCenterX = size / 2;
  const maxPostCenterY = size / 2;
  let grad;
  const cacheKey = size.toString() + knob.type + style.style;

  // check if we have already created and cached this buffer, if not create it
  if (!createKnobImage.cache[cacheKey]) {
    knobBuffer = createBuffer(size * 1.18889, size * 1.18889);
    knobCtx = knobBuffer.getContext('2d');

    switch (knob.type) {
      case 'metalKnob':
        // METALKNOB_FRAME
        knobCtx.beginPath();
        knobCtx.moveTo(0, size * 0.5);
        knobCtx.bezierCurveTo(
          0,
          size * 0.222222,
          size * 0.222222,
          0,
          size * 0.5,
          0
        );
        knobCtx.bezierCurveTo(
          size * 0.777777,
          0,
          size,
          size * 0.222222,
          size,
          size * 0.5
        );
        knobCtx.bezierCurveTo(
          size,
          size * 0.777777,
          size * 0.777777,
          size,
          size * 0.5,
          size
        );
        knobCtx.bezierCurveTo(
          size * 0.222222,
          size,
          0,
          size * 0.777777,
          0,
          size * 0.5
        );
        knobCtx.closePath();
        grad = knobCtx.createLinearGradient(0, 0, 0, size);
        grad.addColorStop(0, 'rgb(92, 95, 101)');
        grad.addColorStop(0.47, 'rgb(46, 49, 53)');
        grad.addColorStop(1, 'rgb(22, 23, 26)');
        knobCtx.fillStyle = grad;
        knobCtx.fill();

        // METALKNOB_MAIN
        knobCtx.beginPath();
        knobCtx.moveTo(size * 0.055555, size * 0.5);
        knobCtx.bezierCurveTo(
          size * 0.055555,
          size * 0.277777,
          size * 0.277777,
          size * 0.055555,
          size * 0.5,
          size * 0.055555
        );
        knobCtx.bezierCurveTo(
          size * 0.722222,
          size * 0.055555,
          size * 0.944444,
          size * 0.277777,
          size * 0.944444,
          size * 0.5
        );
        knobCtx.bezierCurveTo(
          size * 0.944444,
          size * 0.722222,
          size * 0.722222,
          size * 0.944444,
          size * 0.5,
          size * 0.944444
        );
        knobCtx.bezierCurveTo(
          size * 0.277777,
          size * 0.944444,
          size * 0.055555,
          size * 0.722222,
          size * 0.055555,
          size * 0.5
        );
        knobCtx.closePath();
        grad = knobCtx.createLinearGradient(
          0,
          0.055555 * size,
          0,
          0.944443 * size
        );
        switch (style.style) {
          case 'black':
            grad.addColorStop(0, 'rgb(43, 42, 47)');
            grad.addColorStop(1, 'rgb(26, 27, 32)');
            break

          case 'brass':
            grad.addColorStop(0, 'rgb(150, 110, 54)');
            grad.addColorStop(1, 'rgb(124, 95, 61)');
            break

          case 'silver':
          /* falls through */
          default:
            grad.addColorStop(0, 'rgb(204, 204, 204)');
            grad.addColorStop(1, 'rgb(87, 92, 98)');
            break
        }
        knobCtx.fillStyle = grad;
        knobCtx.fill();

        // METALKNOB_LOWERHL
        knobCtx.beginPath();
        knobCtx.moveTo(size * 0.777777, size * 0.833333);
        knobCtx.bezierCurveTo(
          size * 0.722222,
          size * 0.722222,
          size * 0.611111,
          size * 0.666666,
          size * 0.5,
          size * 0.666666
        );
        knobCtx.bezierCurveTo(
          size * 0.388888,
          size * 0.666666,
          size * 0.277777,
          size * 0.722222,
          size * 0.222222,
          size * 0.833333
        );
        knobCtx.bezierCurveTo(
          size * 0.277777,
          size * 0.888888,
          size * 0.388888,
          size * 0.944444,
          size * 0.5,
          size * 0.944444
        );
        knobCtx.bezierCurveTo(
          size * 0.611111,
          size * 0.944444,
          size * 0.722222,
          size * 0.888888,
          size * 0.777777,
          size * 0.833333
        );
        knobCtx.closePath();
        grad = knobCtx.createRadialGradient(
          0.555555 * size,
          0.944444 * size,
          0,
          0.555555 * size,
          0.944444 * size,
          0.388888 * size
        );
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        knobCtx.fillStyle = grad;
        knobCtx.fill();

        // METALKNOB_UPPERHL
        knobCtx.beginPath();
        knobCtx.moveTo(size * 0.944444, size * 0.277777);
        knobCtx.bezierCurveTo(
          size * 0.833333,
          size * 0.111111,
          size * 0.666666,
          0,
          size * 0.5,
          0
        );
        knobCtx.bezierCurveTo(
          size * 0.333333,
          0,
          size * 0.166666,
          size * 0.111111,
          size * 0.055555,
          size * 0.277777
        );
        knobCtx.bezierCurveTo(
          size * 0.166666,
          size * 0.333333,
          size * 0.333333,
          size * 0.388888,
          size * 0.5,
          size * 0.388888
        );
        knobCtx.bezierCurveTo(
          size * 0.666666,
          size * 0.388888,
          size * 0.833333,
          size * 0.333333,
          size * 0.944444,
          size * 0.277777
        );
        knobCtx.closePath();
        grad = knobCtx.createRadialGradient(
          0.5 * size,
          0,
          0,
          0.5 * size,
          0,
          0.583333 * size
        );
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.749019)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        knobCtx.fillStyle = grad;
        knobCtx.fill();

        // METALKNOB_INNERFRAME
        knobCtx.beginPath();
        knobCtx.moveTo(size * 0.277777, size * 0.555555);
        knobCtx.bezierCurveTo(
          size * 0.277777,
          size * 0.388888,
          size * 0.388888,
          size * 0.277777,
          size * 0.5,
          size * 0.277777
        );
        knobCtx.bezierCurveTo(
          size * 0.611111,
          size * 0.277777,
          size * 0.777777,
          size * 0.388888,
          size * 0.777777,
          size * 0.555555
        );
        knobCtx.bezierCurveTo(
          size * 0.777777,
          size * 0.666666,
          size * 0.611111,
          size * 0.777777,
          size * 0.5,
          size * 0.777777
        );
        knobCtx.bezierCurveTo(
          size * 0.388888,
          size * 0.777777,
          size * 0.277777,
          size * 0.666666,
          size * 0.277777,
          size * 0.555555
        );
        knobCtx.closePath();
        grad = knobCtx.createLinearGradient(
          0,
          0.277777 * size,
          0,
          0.722221 * size
        );
        grad.addColorStop(0, '#000000');
        grad.addColorStop(1, 'rgb(204, 204, 204)');
        knobCtx.fillStyle = grad;
        knobCtx.fill();

        // METALKNOB_INNERBACKGROUND
        knobCtx.beginPath();
        knobCtx.moveTo(size * 0.333333, size * 0.555555);
        knobCtx.bezierCurveTo(
          size * 0.333333,
          size * 0.444444,
          size * 0.388888,
          size * 0.333333,
          size * 0.5,
          size * 0.333333
        );
        knobCtx.bezierCurveTo(
          size * 0.611111,
          size * 0.333333,
          size * 0.722222,
          size * 0.444444,
          size * 0.722222,
          size * 0.555555
        );
        knobCtx.bezierCurveTo(
          size * 0.722222,
          size * 0.611111,
          size * 0.611111,
          size * 0.722222,
          size * 0.5,
          size * 0.722222
        );
        knobCtx.bezierCurveTo(
          size * 0.388888,
          size * 0.722222,
          size * 0.333333,
          size * 0.611111,
          size * 0.333333,
          size * 0.555555
        );
        knobCtx.closePath();
        grad = knobCtx.createLinearGradient(
          0,
          0.333333 * size,
          0,
          0.666666 * size
        );
        grad.addColorStop(0, 'rgb(10, 9, 1)');
        grad.addColorStop(1, 'rgb(42, 41, 37)');
        knobCtx.fillStyle = grad;
        knobCtx.fill();
        break

      case 'standardKnob':
        grad = knobCtx.createLinearGradient(0, 0, 0, size);
        grad.addColorStop(0, 'rgb(180, 180, 180)');
        grad.addColorStop(0.46, 'rgb(63, 63, 63)');
        grad.addColorStop(1, 'rgb(40, 40, 40)');
        knobCtx.fillStyle = grad;
        knobCtx.beginPath();
        knobCtx.arc(maxPostCenterX, maxPostCenterY, size / 2, 0, TWO_PI, true);
        knobCtx.closePath();
        knobCtx.fill();
        grad = knobCtx.createLinearGradient(
          0,
          size - size * 0.77,
          0,
          size - size * 0.77 + size * 0.77
        );
        switch (style.style) {
          case 'black':
            grad.addColorStop(0, 'rgb(191, 191, 191)');
            grad.addColorStop(0.5, 'rgb(45, 44, 49)');
            grad.addColorStop(1, 'rgb(125, 126, 128)');
            break

          case 'brass':
            grad.addColorStop(0, 'rgb(223, 208, 174)');
            grad.addColorStop(0.5, 'rgb(123, 95, 63)');
            grad.addColorStop(1, 'rgb(207, 190, 157)');
            break

          case 'silver':
          /* falls through */
          default:
            grad.addColorStop(0, 'rgb(215, 215, 215)');
            grad.addColorStop(0.5, 'rgb(116, 116, 116)');
            grad.addColorStop(1, 'rgb(215, 215, 215)');
            break
        }
        knobCtx.fillStyle = grad;
        knobCtx.beginPath();
        knobCtx.arc(
          maxPostCenterX,
          maxPostCenterY,
          (size * 0.77) / 2,
          0,
          TWO_PI,
          true
        );
        knobCtx.closePath();
        knobCtx.fill();

        grad = knobCtx.createRadialGradient(
          maxPostCenterX,
          maxPostCenterY,
          0,
          maxPostCenterX,
          maxPostCenterY,
          (size * 0.77) / 2
        );
        grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        grad.addColorStop(0.75, 'rgba(0, 0, 0, 0)');
        grad.addColorStop(0.76, 'rgba(0, 0, 0, 0.01)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
        knobCtx.fillStyle = grad;
        knobCtx.beginPath();
        knobCtx.arc(
          maxPostCenterX,
          maxPostCenterY,
          (size * 0.77) / 2,
          0,
          TWO_PI,
          true
        );
        knobCtx.closePath();
        knobCtx.fill();
        break
    }

    // cache the buffer
    createKnobImage.cache[cacheKey] = knobBuffer;
  }
  return createKnobImage.cache[cacheKey]
};
createKnobImage.cache = {};

const BackgroundColor = {
  DARK_GRAY: new BackgroundColorDef(
    new rgbaColor(0, 0, 0, 1),
    new rgbaColor(51, 51, 51, 1),
    new rgbaColor(153, 153, 153, 1),
    new rgbaColor(255, 255, 255, 1),
    new rgbaColor(180, 180, 180, 1),
    'DARK_GRAY'
  ),
  SATIN_GRAY: new BackgroundColorDef(
    new rgbaColor(45, 57, 57, 1),
    new rgbaColor(45, 57, 57, 1),
    new rgbaColor(45, 57, 57, 1),
    new rgbaColor(167, 184, 180, 1),
    new rgbaColor(137, 154, 150, 1),
    'SATIN_GRAY'
  ),
  LIGHT_GRAY: new BackgroundColorDef(
    new rgbaColor(130, 130, 130, 1),
    new rgbaColor(181, 181, 181, 1),
    new rgbaColor(253, 253, 253, 1),
    new rgbaColor(0, 0, 0, 1),
    new rgbaColor(80, 80, 80, 1),
    'LIGHT_GRAY'
  ),
  WHITE: new BackgroundColorDef(
    new rgbaColor(255, 255, 255, 1),
    new rgbaColor(255, 255, 255, 1),
    new rgbaColor(255, 255, 255, 1),
    new rgbaColor(0, 0, 0, 1),
    new rgbaColor(80, 80, 80, 1),
    'WHITE'
  ),
  BLACK: new BackgroundColorDef(
    new rgbaColor(0, 0, 0, 1),
    new rgbaColor(0, 0, 0, 1),
    new rgbaColor(0, 0, 0, 1),
    new rgbaColor(255, 255, 255, 1),
    new rgbaColor(150, 150, 150, 1),
    'BLACK'
  ),
  BEIGE: new BackgroundColorDef(
    new rgbaColor(178, 172, 150, 1),
    new rgbaColor(204, 205, 184, 1),
    new rgbaColor(231, 231, 214, 1),
    new rgbaColor(0, 0, 0, 1),
    new rgbaColor(80, 80, 80, 1),
    'BEIGE'
  ),
  BROWN: new BackgroundColorDef(
    new rgbaColor(245, 225, 193, 1),
    new rgbaColor(245, 225, 193, 1),
    new rgbaColor(255, 250, 240, 1),
    new rgbaColor(109, 73, 47, 1),
    new rgbaColor(89, 53, 27, 1),
    'BROWN'
  ),
  RED: new BackgroundColorDef(
    new rgbaColor(198, 93, 95, 1),
    new rgbaColor(212, 132, 134, 1),
    new rgbaColor(242, 218, 218, 1),
    new rgbaColor(0, 0, 0, 1),
    new rgbaColor(90, 0, 0, 1),
    'RED'
  ),
  GREEN: new BackgroundColorDef(
    new rgbaColor(65, 120, 40, 1),
    new rgbaColor(129, 171, 95, 1),
    new rgbaColor(218, 237, 202, 1),
    new rgbaColor(0, 0, 0, 1),
    new rgbaColor(0, 90, 0, 1),
    'GREEN'
  ),
  BLUE: new BackgroundColorDef(
    new rgbaColor(45, 83, 122, 1),
    new rgbaColor(115, 144, 170, 1),
    new rgbaColor(227, 234, 238, 1),
    new rgbaColor(0, 0, 0, 1),
    new rgbaColor(0, 0, 90, 1),
    'BLUE'
  ),
  ANTHRACITE: new BackgroundColorDef(
    new rgbaColor(50, 50, 54, 1),
    new rgbaColor(47, 47, 51, 1),
    new rgbaColor(69, 69, 74, 1),
    new rgbaColor(250, 250, 250, 1),
    new rgbaColor(180, 180, 180, 1),
    'ANTHRACITE'
  ),
  MUD: new BackgroundColorDef(
    new rgbaColor(80, 86, 82, 1),
    new rgbaColor(70, 76, 72, 1),
    new rgbaColor(57, 62, 58, 1),
    new rgbaColor(255, 255, 240, 1),
    new rgbaColor(225, 225, 210, 1),
    'MUD'
  ),
  PUNCHED_SHEET: new BackgroundColorDef(
    new rgbaColor(50, 50, 54, 1),
    new rgbaColor(47, 47, 51, 1),
    new rgbaColor(69, 69, 74, 1),
    new rgbaColor(255, 255, 255, 1),
    new rgbaColor(180, 180, 180, 1),
    'PUNCHED_SHEET'
  ),
  CARBON: new BackgroundColorDef(
    new rgbaColor(50, 50, 54, 1),
    new rgbaColor(47, 47, 51, 1),
    new rgbaColor(69, 69, 74, 1),
    new rgbaColor(255, 255, 255, 1),
    new rgbaColor(180, 180, 180, 1),
    'CARBON'
  ),
  STAINLESS: new BackgroundColorDef(
    new rgbaColor(130, 130, 130, 1),
    new rgbaColor(181, 181, 181, 1),
    new rgbaColor(253, 253, 253, 1),
    new rgbaColor(0, 0, 0, 1),
    new rgbaColor(80, 80, 80, 1),
    'STAINLESS'
  ),
  BRUSHED_METAL: new BackgroundColorDef(
    new rgbaColor(50, 50, 54, 1),
    new rgbaColor(47, 47, 51, 1),
    new rgbaColor(69, 69, 74, 1),
    new rgbaColor(0, 0, 0, 1),
    new rgbaColor(80, 80, 80, 1),
    'BRUSHED_METAL'
  ),
  BRUSHED_STAINLESS: new BackgroundColorDef(
    new rgbaColor(50, 50, 54, 1),
    new rgbaColor(47, 47, 51, 1),
    new rgbaColor(110, 110, 112, 1),
    new rgbaColor(0, 0, 0, 1),
    new rgbaColor(80, 80, 80, 1),
    'BRUSHED_STAINLESS'
  ),
  TURNED: new BackgroundColorDef(
    new rgbaColor(130, 130, 130, 1),
    new rgbaColor(181, 181, 181, 1),
    new rgbaColor(253, 253, 253, 1),
    new rgbaColor(0, 0, 0, 1),
    new rgbaColor(80, 80, 80, 1),
    'TURNED'
  )
};

const LcdColor = {
  BEIGE: new LcdColorDef(
    '#c8c8b1',
    'rgb(241, 237, 207)',
    'rgb(234, 230, 194)',
    'rgb(225, 220, 183)',
    'rgb(237, 232, 191)',
    '#000000'
  ),
  BLUE: new LcdColorDef(
    '#ffffff',
    'rgb(231, 246, 255)',
    'rgb(170, 224, 255)',
    'rgb(136, 212, 255)',
    'rgb(192, 232, 255)',
    '#124564'
  ),
  ORANGE: new LcdColorDef(
    '#ffffff',
    'rgb(255, 245, 225)',
    'rgb(255, 217, 147)',
    'rgb(255, 201, 104)',
    'rgb(255, 227, 173)',
    '#503700'
  ),
  RED: new LcdColorDef(
    '#ffffff',
    'rgb(255, 225, 225)',
    'rgb(253, 152, 152)',
    'rgb(252, 114, 115)',
    'rgb(254, 178, 178)',
    '#4f0c0e'
  ),
  YELLOW: new LcdColorDef(
    '#ffffff',
    'rgb(245, 255, 186)',
    'rgb(210, 255, 0)',
    'rgb(158, 205, 0)',
    'rgb(210, 255, 0)',
    '#405300'
  ),
  WHITE: new LcdColorDef(
    '#ffffff',
    '#ffffff',
    'rgb(241, 246, 242)',
    'rgb(229, 239, 244)',
    '#ffffff',
    '#000000'
  ),
  GRAY: new LcdColorDef(
    '#414141',
    'rgb(117, 117, 117)',
    'rgb(87, 87, 87)',
    '#414141',
    'rgb(81, 81, 81)',
    '#ffffff'
  ),
  BLACK: new LcdColorDef(
    '#414141',
    '#666666',
    '#333333',
    '#000000',
    '#333333',
    '#cccccc'
  ),
  GREEN: new LcdColorDef(
    'rgb(33, 67, 67)',
    'rgb(33, 67, 67)',
    'rgb(29, 58, 58)',
    'rgb(28, 57, 57)',
    'rgb(23, 46, 46)',
    'rgba(0, 185, 165, 255)'
  ),
  BLUE2: new LcdColorDef(
    'rgb(0, 68, 103)',
    'rgb(8, 109, 165)',
    'rgb(0, 72, 117)',
    'rgb(0, 72, 117)',
    'rgb(0, 68, 103)',
    'rgb(111, 182, 228)'
  ),
  BLUE_BLACK: new LcdColorDef(
    'rgb(22, 125, 212)',
    'rgb(3, 162, 254)',
    'rgb(3, 162, 254)',
    'rgb(3, 162, 254)',
    'rgb(11, 172, 244)',
    '#000000'
  ),
  BLUE_DARKBLUE: new LcdColorDef(
    'rgb(18, 33, 88)',
    'rgb(18, 33, 88)',
    'rgb(19, 30, 90)',
    'rgb(17, 31, 94)',
    'rgb(21, 25, 90)',
    'rgb(23, 99, 221)'
  ),
  BLUE_GRAY: new LcdColorDef(
    'rgb(135, 174, 255)',
    'rgb(101, 159, 255)',
    'rgb(44, 93, 255)',
    'rgb(27, 65, 254)',
    'rgb(12, 50, 255)',
    '#b2b4ed'
  ),
  STANDARD: new LcdColorDef(
    'rgb(131, 133, 119)',
    'rgb(176, 183, 167)',
    'rgb(165, 174, 153)',
    'rgb(166, 175, 156)',
    'rgb(175, 184, 165)',
    'rgb(35, 42, 52)'
  ),
  STANDARD_GREEN: new LcdColorDef(
    '#ffffff',
    'rgb(219, 230, 220)',
    'rgb(179, 194, 178)',
    'rgb(153, 176, 151)',
    'rgb(114, 138, 109)',
    '#080C06'
  ),
  BLUE_BLUE: new LcdColorDef(
    'rgb(100, 168, 253)',
    'rgb(100, 168, 253)',
    'rgb(95, 160, 250)',
    'rgb(80, 144, 252)',
    'rgb(74, 134, 255)',
    '#002cbb'
  ),
  RED_DARKRED: new LcdColorDef(
    'rgb(72, 36, 50)',
    'rgb(185, 111, 110)',
    'rgb(148, 66, 72)',
    'rgb(83, 19, 20)',
    'rgb(7, 6, 14)',
    '#FE8B92'
  ),
  DARKBLUE: new LcdColorDef(
    'rgb(14, 24, 31)',
    'rgb(46, 105, 144)',
    'rgb(19, 64, 96)',
    'rgb(6, 20, 29)',
    'rgb(8, 9, 10)',
    '#3DB3FF'
  ),
  LILA: new LcdColorDef(
    'rgb(175, 164, 255)',
    'rgb(188, 168, 253)',
    'rgb(176, 159, 255)',
    'rgb(174, 147, 252)',
    'rgb(168, 136, 233)',
    '#076148'
  ),
  BLACKRED: new LcdColorDef(
    'rgb(8, 12, 11)',
    'rgb(10, 11, 13)',
    'rgb(11, 10, 15)',
    'rgb(7, 13, 9)',
    'rgb(9, 13, 14)',
    '#B50026'
  ),
  DARKGREEN: new LcdColorDef(
    'rgb(25, 85, 0)',
    'rgb(47, 154, 0)',
    'rgb(30, 101, 0)',
    'rgb(30, 101, 0)',
    'rgb(25, 85, 0)',
    '#233123'
  ),
  AMBER: new LcdColorDef(
    'rgb(182, 71, 0)',
    'rgb(236, 155, 25)',
    'rgb(212, 93, 5)',
    'rgb(212, 93, 5)',
    'rgb(182, 71, 0)',
    '#593A0A'
  ),
  LIGHTBLUE: new LcdColorDef(
    'rgb(125, 146, 184)',
    'rgb(197, 212, 231)',
    'rgb(138, 155, 194)',
    'rgb(138, 155, 194)',
    'rgb(125, 146, 184)',
    '#090051'
  ),
  SECTIONS: new LcdColorDef(
    '#b2b2b2',
    '#ffffff',
    '#c4c4c4',
    '#c4c4c4',
    '#b2b2b2',
    '#000000'
  )
};

const Color$1 = {
  RED: new ColorDef(
    new rgbaColor(82, 0, 0, 1),
    new rgbaColor(158, 0, 19, 1),
    new rgbaColor(213, 0, 25, 1),
    new rgbaColor(240, 82, 88, 1),
    new rgbaColor(255, 171, 173, 1),
    new rgbaColor(255, 217, 218, 1)
  ),
  GREEN: new ColorDef(
    new rgbaColor(8, 54, 4, 1),
    new rgbaColor(0, 107, 14, 1),
    new rgbaColor(15, 148, 0, 1),
    new rgbaColor(121, 186, 37, 1),
    new rgbaColor(190, 231, 141, 1),
    new rgbaColor(234, 247, 218, 1)
  ),
  BLUE: new ColorDef(
    new rgbaColor(0, 11, 68, 1),
    new rgbaColor(0, 73, 135, 1),
    new rgbaColor(0, 108, 201, 1),
    new rgbaColor(0, 141, 242, 1),
    new rgbaColor(122, 200, 255, 1),
    new rgbaColor(204, 236, 255, 1)
  ),
  ORANGE: new ColorDef(
    new rgbaColor(118, 83, 30, 1),
    new rgbaColor(215, 67, 0, 1),
    new rgbaColor(240, 117, 0, 1),
    new rgbaColor(255, 166, 0, 1),
    new rgbaColor(255, 255, 128, 1),
    new rgbaColor(255, 247, 194, 1)
  ),
  YELLOW: new ColorDef(
    new rgbaColor(41, 41, 0, 1),
    new rgbaColor(102, 102, 0, 1),
    new rgbaColor(177, 165, 0, 1),
    new rgbaColor(255, 242, 0, 1),
    new rgbaColor(255, 250, 153, 1),
    new rgbaColor(255, 252, 204, 1)
  ),
  CYAN: new ColorDef(
    new rgbaColor(15, 109, 109, 1),
    new rgbaColor(0, 109, 144, 1),
    new rgbaColor(0, 144, 191, 1),
    new rgbaColor(0, 174, 239, 1),
    new rgbaColor(153, 223, 249, 1),
    new rgbaColor(204, 239, 252, 1)
  ),
  MAGENTA: new ColorDef(
    new rgbaColor(98, 0, 114, 1),
    new rgbaColor(128, 24, 72, 1),
    new rgbaColor(191, 36, 107, 1),
    new rgbaColor(255, 48, 143, 1),
    new rgbaColor(255, 172, 210, 1),
    new rgbaColor(255, 214, 23, 1)
  ),
  WHITE: new ColorDef(
    new rgbaColor(210, 210, 210, 1),
    new rgbaColor(220, 220, 220, 1),
    new rgbaColor(235, 235, 235, 1),
    new rgbaColor(255, 255, 255, 1),
    new rgbaColor(255, 255, 255, 1),
    new rgbaColor(255, 255, 255, 1)
  ),
  GRAY: new ColorDef(
    new rgbaColor(25, 25, 25, 1),
    new rgbaColor(51, 51, 51, 1),
    new rgbaColor(76, 76, 76, 1),
    new rgbaColor(128, 128, 128, 1),
    new rgbaColor(204, 204, 204, 1),
    new rgbaColor(243, 243, 243, 1)
  ),
  BLACK: new ColorDef(
    new rgbaColor(0, 0, 0, 1),
    new rgbaColor(5, 5, 5, 1),
    new rgbaColor(10, 10, 10, 1),
    new rgbaColor(15, 15, 15, 1),
    new rgbaColor(20, 20, 20, 1),
    new rgbaColor(25, 25, 25, 1)
  ),
  RAITH: new ColorDef(
    new rgbaColor(0, 32, 65, 1),
    new rgbaColor(0, 65, 125, 1),
    new rgbaColor(0, 106, 172, 1),
    new rgbaColor(130, 180, 214, 1),
    new rgbaColor(148, 203, 242, 1),
    new rgbaColor(191, 229, 255, 1)
  ),
  GREEN_LCD: new ColorDef(
    new rgbaColor(0, 55, 45, 1),
    new rgbaColor(15, 109, 93, 1),
    new rgbaColor(0, 185, 165, 1),
    new rgbaColor(48, 255, 204, 1),
    new rgbaColor(153, 255, 227, 1),
    new rgbaColor(204, 255, 241, 1)
  ),
  JUG_GREEN: new ColorDef(
    new rgbaColor(0, 56, 0, 1),
    new rgbaColor(32, 69, 36, 1),
    new rgbaColor(50, 161, 0, 1),
    new rgbaColor(129, 206, 0, 1),
    new rgbaColor(190, 231, 141, 1),
    new rgbaColor(234, 247, 218, 1)
  )
};

const LedColor = {
  RED_LED: new LedColorDef(
    '#FF9A89',
    '#FF9A89',
    '#FF3300',
    '#FF8D70',
    '#7E1C00',
    '#7E1C00',
    '#641B00'
  ),
  GREEN_LED: new LedColorDef(
    '#9AFF89',
    '#9AFF89',
    '#59FF2A',
    '#A5FF00',
    '#1C7E00',
    '#1C7E00',
    '#1B6400'
  ),
  BLUE_LED: new LedColorDef(
    '#899AFF',
    '#899AFF',
    '#0033FF',
    '#708DFF',
    '#001C7E',
    '#001C7E',
    '#001B64'
  ),
  ORANGE_LED: new LedColorDef(
    '#FEA23F',
    '#FEA23F',
    '#FD6C00',
    '#FD6C00',
    '#592800',
    '#592800',
    '#421F00'
  ),
  YELLOW_LED: new LedColorDef(
    '#FFFF62',
    '#FFFF62',
    '#FFFF00',
    '#FFFF00',
    '#6B6D00',
    '#6B6D00',
    '#515300'
  ),
  CYAN_LED: new LedColorDef(
    '#00FFFF',
    '#00FFFF',
    '#1BC3C3',
    '#00FFFF',
    '#083B3B',
    '#083B3B',
    '#052727'
  ),
  MAGENTA_LED: new LedColorDef(
    '#D300FF',
    '#D300FF',
    '#8600CB',
    '#C300FF',
    '#38004B',
    '#38004B',
    '#280035'
  )
};

const GaugeType = {
  TYPE1: new GaugeTypeDef('type1'),
  TYPE2: new GaugeTypeDef('type2'),
  TYPE3: new GaugeTypeDef('type3'),
  TYPE4: new GaugeTypeDef('type4'),
  TYPE5: new GaugeTypeDef('type5')
};

const Orientation = {
  NORTH: new OrientationDef('north'),
  SOUTH: new OrientationDef('south'),
  EAST: new OrientationDef('east'),
  WEST: new OrientationDef('west')
};

const KnobType = {
  STANDARD_KNOB: new KnobTypeDef('standardKnob'),
  METAL_KNOB: new KnobTypeDef('metalKnob')
};

const KnobStyle = {
  BLACK: new KnobStyleDef('black'),
  BRASS: new KnobStyleDef('brass'),
  SILVER: new KnobStyleDef('silver')
};

const FrameDesign = {
  BLACK_METAL: new FrameDesignDef('blackMetal'),
  METAL: new FrameDesignDef('metal'),
  SHINY_METAL: new FrameDesignDef('shinyMetal'),
  BRASS: new FrameDesignDef('brass'),
  STEEL: new FrameDesignDef('steel'),
  CHROME: new FrameDesignDef('chrome'),
  GOLD: new FrameDesignDef('gold'),
  ANTHRACITE: new FrameDesignDef('anthracite'),
  TILTED_GRAY: new FrameDesignDef('tiltedGray'),
  TILTED_BLACK: new FrameDesignDef('tiltedBlack'),
  GLOSSY_METAL: new FrameDesignDef('glossyMetal')
};

const PointerType = {
  TYPE1: new PointerTypeDef('type1'),
  TYPE2: new PointerTypeDef('type2'),
  TYPE3: new PointerTypeDef('type3'),
  TYPE4: new PointerTypeDef('type4'),
  TYPE5: new PointerTypeDef('type5'),
  TYPE6: new PointerTypeDef('type6'),
  TYPE7: new PointerTypeDef('type7'),
  TYPE8: new PointerTypeDef('type8'),
  TYPE9: new PointerTypeDef('type9'),
  TYPE10: new PointerTypeDef('type10'),
  TYPE11: new PointerTypeDef('type11'),
  TYPE12: new PointerTypeDef('type12'),
  TYPE13: new PointerTypeDef('type13'),
  TYPE14: new PointerTypeDef('type14'),
  TYPE15: new PointerTypeDef('type15'),
  TYPE16: new PointerTypeDef('type16')
};

const ForegroundType = {
  TYPE1: new ForegroundTypeDef('type1'),
  TYPE2: new ForegroundTypeDef('type2'),
  TYPE3: new ForegroundTypeDef('type3'),
  TYPE4: new ForegroundTypeDef('type4'),
  TYPE5: new ForegroundTypeDef('type5')
};

const LabelNumberFormat = {
  STANDARD: new LabelNumberFormatDef('standard'),
  FRACTIONAL: new LabelNumberFormatDef('fractional'),
  SCIENTIFIC: new LabelNumberFormatDef('scientific')
};

const TickLabelOrientation = {
  NORMAL: new TickLabelOrientationDef('normal'),
  HORIZONTAL: new TickLabelOrientationDef('horizontal'),
  TANGENT: new TickLabelOrientationDef('tangent')
};

const TrendState = {
  UP: new TrendStateDef('up'),
  STEADY: new TrendStateDef('steady'),
  DOWN: new TrendStateDef('down'),
  OFF: new TrendStateDef('off')
};

const drawForeground = function (
  ctx,
  foregroundType,
  imageWidth,
  imageHeight,
  withCenterKnob,
  knob,
  style,
  gaugeType,
  orientation
) {
  let radFgBuffer;
  let radFgCtx;
  const knobSize = Math.ceil(imageHeight * 0.084112);
  let knobX = imageWidth * 0.5 - knobSize / 2;
  let knobY = imageHeight * 0.5 - knobSize / 2;
  const shadowOffset = imageWidth * 0.008;
  let gradHighlight;
  let gradHighlight2;
  const cacheKey =
    foregroundType.type +
    imageWidth +
    imageHeight +
    withCenterKnob +
    (knob !== undefined ? knob.type : '-') +
    (style !== undefined ? style.style : '-') +
    (orientation !== undefined ? orientation.type : '-');

  // check if we have already created and cached this buffer, if so return it and exit
  if (!drawForeground.cache[cacheKey]) {
    // Setup buffer
    radFgBuffer = createBuffer(imageWidth, imageHeight);
    radFgCtx = radFgBuffer.getContext('2d');

    // center post
    if (withCenterKnob) {
      // Set the pointer shadow params
      radFgCtx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      radFgCtx.shadowOffsetX = radFgCtx.shadowOffsetY = shadowOffset;
      radFgCtx.shadowBlur = shadowOffset * 2;

      if (gaugeType === GaugeType.TYPE5) {
        if (Orientation.WEST === orientation) {
          knobX = imageWidth * 0.733644 - knobSize / 2;
          radFgCtx.drawImage(
            createKnobImage(knobSize, knob, style),
            knobX,
            knobY
          );
        } else if (Orientation.EAST === orientation) {
          knobX = imageWidth * (1 - 0.733644) - knobSize / 2;
          radFgCtx.drawImage(
            createKnobImage(knobSize, knob, style),
            knobX,
            knobY
          );
        } else {
          knobY = imageHeight * 0.733644 - knobSize / 2;
          radFgCtx.drawImage(
            createKnobImage(knobSize, knob, style),
            knobX,
            imageHeight * 0.6857
          );
        }
      } else {
        radFgCtx.drawImage(
          createKnobImage(knobSize, knob, style),
          knobX,
          knobY
        );
      }
      // Undo shadow drawing
      radFgCtx.shadowOffsetX = radFgCtx.shadowOffsetY = 0;
      radFgCtx.shadowBlur = 0;
    }

    // highlight
    switch (foregroundType.type) {
      case 'type2':
        radFgCtx.beginPath();
        radFgCtx.moveTo(imageWidth * 0.135514, imageHeight * 0.696261);
        radFgCtx.bezierCurveTo(
          imageWidth * 0.214953,
          imageHeight * 0.588785,
          imageWidth * 0.317757,
          imageHeight * 0.5,
          imageWidth * 0.462616,
          imageHeight * 0.425233
        );
        radFgCtx.bezierCurveTo(
          imageWidth * 0.612149,
          imageHeight * 0.345794,
          imageWidth * 0.733644,
          imageHeight * 0.317757,
          imageWidth * 0.873831,
          imageHeight * 0.322429
        );
        radFgCtx.bezierCurveTo(
          imageWidth * 0.766355,
          imageHeight * 0.112149,
          imageWidth * 0.528037,
          imageHeight * 0.023364,
          imageWidth * 0.313084,
          imageHeight * 0.130841
        );
        radFgCtx.bezierCurveTo(
          imageWidth * 0.09813,
          imageHeight * 0.238317,
          imageWidth * 0.028037,
          imageHeight * 0.485981,
          imageWidth * 0.135514,
          imageHeight * 0.696261
        );
        radFgCtx.closePath();
        gradHighlight = radFgCtx.createLinearGradient(
          0.313084 * imageWidth,
          0.135514 * imageHeight,
          0.495528 * imageWidth,
          0.493582 * imageHeight
        );
        gradHighlight.addColorStop(0, 'rgba(255, 255, 255, 0.275)');
        gradHighlight.addColorStop(1, 'rgba(255, 255, 255, 0.015)');
        break

      case 'type3':
        radFgCtx.beginPath();
        radFgCtx.moveTo(imageWidth * 0.084112, imageHeight * 0.509345);
        radFgCtx.bezierCurveTo(
          imageWidth * 0.21028,
          imageHeight * 0.556074,
          imageWidth * 0.462616,
          imageHeight * 0.560747,
          imageWidth * 0.5,
          imageHeight * 0.560747
        );
        radFgCtx.bezierCurveTo(
          imageWidth * 0.537383,
          imageHeight * 0.560747,
          imageWidth * 0.794392,
          imageHeight * 0.560747,
          imageWidth * 0.915887,
          imageHeight * 0.509345
        );
        radFgCtx.bezierCurveTo(
          imageWidth * 0.915887,
          imageHeight * 0.2757,
          imageWidth * 0.738317,
          imageHeight * 0.084112,
          imageWidth * 0.5,
          imageHeight * 0.084112
        );
        radFgCtx.bezierCurveTo(
          imageWidth * 0.261682,
          imageHeight * 0.084112,
          imageWidth * 0.084112,
          imageHeight * 0.2757,
          imageWidth * 0.084112,
          imageHeight * 0.509345
        );
        radFgCtx.closePath();
        gradHighlight = radFgCtx.createLinearGradient(
          0,
          0.093457 * imageHeight,
          0,
          0.556073 * imageHeight
        );
        gradHighlight.addColorStop(0, 'rgba(255, 255, 255, 0.275)');
        gradHighlight.addColorStop(1, 'rgba(255, 255, 255, 0.015)');
        break

      case 'type4':
        radFgCtx.beginPath();
        radFgCtx.moveTo(imageWidth * 0.67757, imageHeight * 0.24299);
        radFgCtx.bezierCurveTo(
          imageWidth * 0.771028,
          imageHeight * 0.308411,
          imageWidth * 0.822429,
          imageHeight * 0.411214,
          imageWidth * 0.813084,
          imageHeight * 0.528037
        );
        radFgCtx.bezierCurveTo(
          imageWidth * 0.799065,
          imageHeight * 0.654205,
          imageWidth * 0.719626,
          imageHeight * 0.757009,
          imageWidth * 0.593457,
          imageHeight * 0.799065
        );
        radFgCtx.bezierCurveTo(
          imageWidth * 0.485981,
          imageHeight * 0.831775,
          imageWidth * 0.369158,
          imageHeight * 0.808411,
          imageWidth * 0.285046,
          imageHeight * 0.728971
        );
        radFgCtx.bezierCurveTo(
          imageWidth * 0.2757,
          imageHeight * 0.719626,
          imageWidth * 0.252336,
          imageHeight * 0.714953,
          imageWidth * 0.233644,
          imageHeight * 0.728971
        );
        radFgCtx.bezierCurveTo(
          imageWidth * 0.214953,
          imageHeight * 0.747663,
          imageWidth * 0.219626,
          imageHeight * 0.771028,
          imageWidth * 0.228971,
          imageHeight * 0.7757
        );
        radFgCtx.bezierCurveTo(
          imageWidth * 0.331775,
          imageHeight * 0.878504,
          imageWidth * 0.476635,
          imageHeight * 0.915887,
          imageWidth * 0.616822,
          imageHeight * 0.869158
        );
        radFgCtx.bezierCurveTo(
          imageWidth * 0.771028,
          imageHeight * 0.822429,
          imageWidth * 0.873831,
          imageHeight * 0.691588,
          imageWidth * 0.88785,
          imageHeight * 0.53271
        );
        radFgCtx.bezierCurveTo(
          imageWidth * 0.897196,
          imageHeight * 0.38785,
          imageWidth * 0.836448,
          imageHeight * 0.257009,
          imageWidth * 0.719626,
          imageHeight * 0.182242
        );
        radFgCtx.bezierCurveTo(
          imageWidth * 0.705607,
          imageHeight * 0.172897,
          imageWidth * 0.682242,
          imageHeight * 0.163551,
          imageWidth * 0.663551,
          imageHeight * 0.186915
        );
        radFgCtx.bezierCurveTo(
          imageWidth * 0.654205,
          imageHeight * 0.205607,
          imageWidth * 0.668224,
          imageHeight * 0.238317,
          imageWidth * 0.67757,
          imageHeight * 0.24299
        );
        radFgCtx.closePath();
        gradHighlight = radFgCtx.createRadialGradient(
          0.5 * imageWidth,
          0.5 * imageHeight,
          0,
          0.5 * imageWidth,
          0.5 * imageHeight,
          0.38785 * imageWidth
        );
        gradHighlight.addColorStop(0, 'rgba(255, 255, 255, 0)');
        gradHighlight.addColorStop(0.82, 'rgba(255, 255, 255, 0)');
        gradHighlight.addColorStop(0.83, 'rgba(255, 255, 255, 0)');
        gradHighlight.addColorStop(1, 'rgba(255, 255, 255, 0.15)');

        radFgCtx.beginPath();
        radFgCtx.moveTo(imageWidth * 0.261682, imageHeight * 0.224299);
        radFgCtx.bezierCurveTo(
          imageWidth * 0.285046,
          imageHeight * 0.238317,
          imageWidth * 0.252336,
          imageHeight * 0.285046,
          imageWidth * 0.24299,
          imageHeight * 0.317757
        );
        radFgCtx.bezierCurveTo(
          imageWidth * 0.24299,
          imageHeight * 0.350467,
          imageWidth * 0.271028,
          imageHeight * 0.383177,
          imageWidth * 0.271028,
          imageHeight * 0.397196
        );
        radFgCtx.bezierCurveTo(
          imageWidth * 0.2757,
          imageHeight * 0.415887,
          imageWidth * 0.261682,
          imageHeight * 0.457943,
          imageWidth * 0.238317,
          imageHeight * 0.509345
        );
        radFgCtx.bezierCurveTo(
          imageWidth * 0.224299,
          imageHeight * 0.542056,
          imageWidth * 0.17757,
          imageHeight * 0.612149,
          imageWidth * 0.158878,
          imageHeight * 0.612149
        );
        radFgCtx.bezierCurveTo(
          imageWidth * 0.144859,
          imageHeight * 0.612149,
          imageWidth * 0.088785,
          imageHeight * 0.546728,
          imageWidth * 0.130841,
          imageHeight * 0.369158
        );
        radFgCtx.bezierCurveTo(
          imageWidth * 0.140186,
          imageHeight * 0.336448,
          imageWidth * 0.214953,
          imageHeight * 0.200934,
          imageWidth * 0.261682,
          imageHeight * 0.224299
        );
        radFgCtx.closePath();
        gradHighlight2 = radFgCtx.createLinearGradient(
          0.130841 * imageWidth,
          0.369158 * imageHeight,
          0.273839 * imageWidth,
          0.412877 * imageHeight
        );
        gradHighlight2.addColorStop(0, 'rgba(255, 255, 255, 0.275)');
        gradHighlight2.addColorStop(1, 'rgba(255, 255, 255, 0.015)');
        radFgCtx.fillStyle = gradHighlight2;
        radFgCtx.fill();
        break

      case 'type5':
        radFgCtx.beginPath();
        radFgCtx.moveTo(imageWidth * 0.084112, imageHeight * 0.5);
        radFgCtx.bezierCurveTo(
          imageWidth * 0.084112,
          imageHeight * 0.271028,
          imageWidth * 0.271028,
          imageHeight * 0.084112,
          imageWidth * 0.5,
          imageHeight * 0.084112
        );
        radFgCtx.bezierCurveTo(
          imageWidth * 0.700934,
          imageHeight * 0.084112,
          imageWidth * 0.864485,
          imageHeight * 0.224299,
          imageWidth * 0.906542,
          imageHeight * 0.411214
        );
        radFgCtx.bezierCurveTo(
          imageWidth * 0.911214,
          imageHeight * 0.439252,
          imageWidth * 0.911214,
          imageHeight * 0.518691,
          imageWidth * 0.845794,
          imageHeight * 0.537383
        );
        radFgCtx.bezierCurveTo(
          imageWidth * 0.794392,
          imageHeight * 0.546728,
          imageWidth * 0.551401,
          imageHeight * 0.411214,
          imageWidth * 0.392523,
          imageHeight * 0.457943
        );
        radFgCtx.bezierCurveTo(
          imageWidth * 0.168224,
          imageHeight * 0.509345,
          imageWidth * 0.135514,
          imageHeight * 0.7757,
          imageWidth * 0.093457,
          imageHeight * 0.593457
        );
        radFgCtx.bezierCurveTo(
          imageWidth * 0.088785,
          imageHeight * 0.560747,
          imageWidth * 0.084112,
          imageHeight * 0.53271,
          imageWidth * 0.084112,
          imageHeight * 0.5
        );
        radFgCtx.closePath();
        gradHighlight = radFgCtx.createLinearGradient(
          0,
          0.084112 * imageHeight,
          0,
          0.644859 * imageHeight
        );
        gradHighlight.addColorStop(0, 'rgba(255, 255, 255, 0.275)');
        gradHighlight.addColorStop(1, 'rgba(255, 255, 255, 0.015)');
        break

      case 'type1':
      /* falls through */
      default:
        radFgCtx.beginPath();
        radFgCtx.moveTo(imageWidth * 0.084112, imageHeight * 0.509345);
        radFgCtx.bezierCurveTo(
          imageWidth * 0.205607,
          imageHeight * 0.448598,
          imageWidth * 0.336448,
          imageHeight * 0.415887,
          imageWidth * 0.5,
          imageHeight * 0.415887
        );
        radFgCtx.bezierCurveTo(
          imageWidth * 0.672897,
          imageHeight * 0.415887,
          imageWidth * 0.789719,
          imageHeight * 0.443925,
          imageWidth * 0.915887,
          imageHeight * 0.509345
        );
        radFgCtx.bezierCurveTo(
          imageWidth * 0.915887,
          imageHeight * 0.2757,
          imageWidth * 0.738317,
          imageHeight * 0.084112,
          imageWidth * 0.5,
          imageHeight * 0.084112
        );
        radFgCtx.bezierCurveTo(
          imageWidth * 0.261682,
          imageHeight * 0.084112,
          imageWidth * 0.084112,
          imageHeight * 0.2757,
          imageWidth * 0.084112,
          imageHeight * 0.509345
        );
        radFgCtx.closePath();
        gradHighlight = radFgCtx.createLinearGradient(
          0,
          0.088785 * imageHeight,
          0,
          0.490654 * imageHeight
        );
        gradHighlight.addColorStop(0, 'rgba(255, 255, 255, 0.275)');
        gradHighlight.addColorStop(1, 'rgba(255, 255, 255, 0.015)');
        break
    }
    radFgCtx.fillStyle = gradHighlight;
    radFgCtx.fill();

    // cache the buffer
    drawForeground.cache[cacheKey] = radFgBuffer;
  }
  ctx.drawImage(drawForeground.cache[cacheKey], 0, 0);
  return this
};
drawForeground.cache = {};

const createLedImage = function (size, state, ledColor) {
  let ledBuffer;
  let ledCtx;
  // Bug in Chrome browser, radialGradients do not draw correctly if the center is not an integer value
  const ledCenterX = 2 * Math.round(size / 4);
  const ledCenterY = 2 * Math.round(size / 4);
  let grad;
  const cacheKey = size.toString() + state + ledColor.outerColor_ON;

  // check if we have already created and cached this buffer, if not create it
  if (!createLedImage.cache[cacheKey]) {
    ledBuffer = createBuffer(size, size);
    ledCtx = ledBuffer.getContext('2d');

    switch (state) {
      case 0: // LED OFF
        // OFF Gradient
        grad = ledCtx.createRadialGradient(
          ledCenterX,
          ledCenterY,
          0,
          ledCenterX,
          ledCenterY,
          (size * 0.5) / 2
        );
        grad.addColorStop(0, ledColor.innerColor1_OFF);
        grad.addColorStop(0.2, ledColor.innerColor2_OFF);
        grad.addColorStop(1, ledColor.outerColor_OFF);
        ledCtx.fillStyle = grad;

        ledCtx.beginPath();
        ledCtx.arc(ledCenterX, ledCenterY, (size * 0.5) / 2, 0, TWO_PI, true);
        ledCtx.closePath();
        ledCtx.fill();

        // InnerShadow
        grad = ledCtx.createRadialGradient(
          ledCenterX,
          ledCenterY,
          0,
          ledCenterX,
          ledCenterY,
          (size * 0.5) / 2
        );
        grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        grad.addColorStop(0.8, 'rgba(0, 0, 0, 0)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
        ledCtx.fillStyle = grad;

        ledCtx.beginPath();
        ledCtx.arc(ledCenterX, ledCenterY, (size * 0.5) / 2, 0, TWO_PI, true);
        ledCtx.closePath();
        ledCtx.fill();

        // LightReflex
        grad = ledCtx.createLinearGradient(
          0,
          0.35 * size,
          0,
          0.35 * size + 0.15 * size
        );
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ledCtx.fillStyle = grad;

        ledCtx.beginPath();
        ledCtx.arc(
          ledCenterX,
          0.35 * size + (0.2 * size) / 2,
          size * 0.2,
          0,
          TWO_PI,
          true
        );
        ledCtx.closePath();
        ledCtx.fill();
        break

      case 1: // LED ON
        // ON Gradient
        grad = ledCtx.createRadialGradient(
          ledCenterX,
          ledCenterY,
          0,
          ledCenterX,
          ledCenterY,
          (size * 0.5) / 2
        );
        grad.addColorStop(0, ledColor.innerColor1_ON);
        grad.addColorStop(0.2, ledColor.innerColor2_ON);
        grad.addColorStop(1, ledColor.outerColor_ON);
        ledCtx.fillStyle = grad;

        ledCtx.beginPath();
        ledCtx.arc(ledCenterX, ledCenterY, (size * 0.5) / 2, 0, TWO_PI, true);
        ledCtx.closePath();
        ledCtx.fill();

        // InnerShadow
        grad = ledCtx.createRadialGradient(
          ledCenterX,
          ledCenterY,
          0,
          ledCenterX,
          ledCenterY,
          (size * 0.5) / 2
        );
        grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        grad.addColorStop(0.8, 'rgba(0, 0, 0, 0)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
        ledCtx.fillStyle = grad;

        ledCtx.beginPath();
        ledCtx.arc(ledCenterX, ledCenterY, (size * 0.5) / 2, 0, TWO_PI, true);
        ledCtx.closePath();
        ledCtx.fill();

        // LightReflex
        grad = ledCtx.createLinearGradient(
          0,
          0.35 * size,
          0,
          0.35 * size + 0.15 * size
        );
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ledCtx.fillStyle = grad;

        ledCtx.beginPath();
        ledCtx.arc(
          ledCenterX,
          0.35 * size + (0.2 * size) / 2,
          size * 0.2,
          0,
          TWO_PI,
          true
        );
        ledCtx.closePath();
        ledCtx.fill();

        // Corona
        grad = ledCtx.createRadialGradient(
          ledCenterX,
          ledCenterY,
          0,
          ledCenterX,
          ledCenterY,
          size / 2
        );
        grad.addColorStop(0, setAlpha(ledColor.coronaColor, 0));
        grad.addColorStop(0.6, setAlpha(ledColor.coronaColor, 0.4));
        grad.addColorStop(0.7, setAlpha(ledColor.coronaColor, 0.25));
        grad.addColorStop(0.8, setAlpha(ledColor.coronaColor, 0.15));
        grad.addColorStop(0.85, setAlpha(ledColor.coronaColor, 0.05));
        grad.addColorStop(1, setAlpha(ledColor.coronaColor, 0));
        ledCtx.fillStyle = grad;

        ledCtx.beginPath();
        ledCtx.arc(ledCenterX, ledCenterY, size / 2, 0, TWO_PI, true);
        ledCtx.closePath();
        ledCtx.fill();
        break
    }
    // cache the buffer
    createLedImage.cache[cacheKey] = ledBuffer;
  }
  return createLedImage.cache[cacheKey]
};
createLedImage.cache = {};

const createLcdBackgroundImage = function (width, height, lcdColor) {
  let lcdBuffer;
  let lcdCtx;
  const xB = 0;
  const yB = 0;
  const wB = width;
  const hB = height;
  const rB = Math.min(width, height) * 0.095;
  let grad;
  const xF = 1;
  const yF = 1;
  const wF = width - 2;
  const hF = height - 2;
  const rF = rB - 1;
  const cacheKey = width.toString() + height + JSON.stringify(lcdColor);

  // check if we have already created and cached this buffer, if not create it
  if (!createLcdBackgroundImage.cache[cacheKey]) {
    lcdBuffer = createBuffer(width, height);
    lcdCtx = lcdBuffer.getContext('2d');
    // background
    grad = lcdCtx.createLinearGradient(0, yB, 0, yB + hB);
    grad.addColorStop(0, '#4c4c4c');
    grad.addColorStop(0.08, '#666666');
    grad.addColorStop(0.92, '#666666');
    grad.addColorStop(1, '#e6e6e6');
    lcdCtx.fillStyle = grad;
    roundedRectangle(lcdCtx, xB, yB, wB, hB, rB);
    lcdCtx.fill();

    // foreground
    grad = lcdCtx.createLinearGradient(0, yF, 0, yF + hF);
    grad.addColorStop(0, lcdColor.gradientStartColor);
    grad.addColorStop(0.03, lcdColor.gradientFraction1Color);
    grad.addColorStop(0.49, lcdColor.gradientFraction2Color);
    grad.addColorStop(0.5, lcdColor.gradientFraction3Color);
    grad.addColorStop(1, lcdColor.gradientStopColor);
    lcdCtx.fillStyle = grad;
    roundedRectangle(lcdCtx, xF, yF, wF, hF, rF);
    lcdCtx.fill();
    // cache the buffer
    createLcdBackgroundImage.cache[cacheKey] = lcdBuffer;
  }
  return createLcdBackgroundImage.cache[cacheKey]
};
createLcdBackgroundImage.cache = {};

const createMeasuredValueImage = function (
  size,
  indicatorColor,
  radial,
  vertical
) {
  let indicatorBuffer;
  let indicatorCtx;
  const cacheKey = size.toString() + indicatorColor + radial + vertical;

  // check if we have already created and cached this buffer, if so return it and exit
  if (!createMeasuredValueImage.cache[cacheKey]) {
    indicatorBuffer = doc.createElement('canvas');
    indicatorCtx = indicatorBuffer.getContext('2d');
    indicatorBuffer.width = size;
    indicatorBuffer.height = size;
    indicatorCtx.fillStyle = indicatorColor;
    if (radial) {
      indicatorCtx.beginPath();
      indicatorCtx.moveTo(size * 0.5, size);
      indicatorCtx.lineTo(0, 0);
      indicatorCtx.lineTo(size, 0);
      indicatorCtx.closePath();
      indicatorCtx.fill();
    } else {
      if (vertical) {
        indicatorCtx.beginPath();
        indicatorCtx.moveTo(size, size * 0.5);
        indicatorCtx.lineTo(0, 0);
        indicatorCtx.lineTo(0, size);
        indicatorCtx.closePath();
        indicatorCtx.fill();
      } else {
        indicatorCtx.beginPath();
        indicatorCtx.moveTo(size * 0.5, 0);
        indicatorCtx.lineTo(size, size);
        indicatorCtx.lineTo(0, size);
        indicatorCtx.closePath();
        indicatorCtx.fill();
      }
    }
    // cache the buffer
    createMeasuredValueImage.cache[cacheKey] = indicatorBuffer;
  }
  return createMeasuredValueImage.cache[cacheKey]
};
createMeasuredValueImage.cache = {};

const createTrendIndicator = function (width, onSection, colors) {
  const height = width * 2;
  let trendBuffer;
  let trendCtx;
  let fill;
  const cacheKey = onSection.state + width + JSON.stringify(colors);

  const drawUpArrow = function () {
    // draw up arrow (red)
    const ledColor = colors[0];

    if (onSection.state === 'up') {
      fill = trendCtx.createRadialGradient(
        0.5 * width,
        0.2 * height,
        0,
        0.5 * width,
        0.2 * height,
        0.5 * width
      );
      fill.addColorStop(0, ledColor.innerColor1_ON);
      fill.addColorStop(0.2, ledColor.innerColor2_ON);
      fill.addColorStop(1, ledColor.outerColor_ON);
    } else {
      fill = trendCtx.createLinearGradient(0, 0, 0, 0.5 * height);
      fill.addColorStop(0, '#323232');
      fill.addColorStop(1, '#5c5c5c');
    }
    trendCtx.fillStyle = fill;
    trendCtx.beginPath();
    trendCtx.moveTo(0.5 * width, 0);
    trendCtx.lineTo(width, 0.2 * height);
    trendCtx.lineTo(0.752 * width, 0.2 * height);
    trendCtx.lineTo(0.752 * width, 0.37 * height);
    trendCtx.lineTo(0.252 * width, 0.37 * height);
    trendCtx.lineTo(0.252 * width, 0.2 * height);
    trendCtx.lineTo(0, 0.2 * height);
    trendCtx.closePath();
    trendCtx.fill();
    if (onSection.state !== 'up') {
      // Inner shadow
      trendCtx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
      trendCtx.beginPath();
      trendCtx.moveTo(0, 0.2 * height);
      trendCtx.lineTo(0.5 * width, 0);
      trendCtx.lineTo(width, 0.2 * height);
      trendCtx.moveTo(0.252 * width, 0.2 * height);
      trendCtx.lineTo(0.252 * width, 0.37 * height);
      trendCtx.stroke();
      // Inner highlight
      trendCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      trendCtx.beginPath();
      trendCtx.moveTo(0.252 * width, 0.37 * height);
      trendCtx.lineTo(0.752 * width, 0.37 * height);
      trendCtx.lineTo(0.752 * width, 0.2 * height);
      trendCtx.lineTo(width, 0.2 * height);
      trendCtx.stroke();
    } else {
      // draw halo
      fill = trendCtx.createRadialGradient(
        0.5 * width,
        0.2 * height,
        0,
        0.5 * width,
        0.2 * height,
        0.7 * width
      );
      fill.addColorStop(0, setAlpha(ledColor.coronaColor, 0));
      fill.addColorStop(0.5, setAlpha(ledColor.coronaColor, 0.3));
      fill.addColorStop(0.7, setAlpha(ledColor.coronaColor, 0.2));
      fill.addColorStop(0.8, setAlpha(ledColor.coronaColor, 0.1));
      fill.addColorStop(0.85, setAlpha(ledColor.coronaColor, 0.05));
      fill.addColorStop(1, setAlpha(ledColor.coronaColor, 0));
      trendCtx.fillStyle = fill;

      trendCtx.beginPath();
      trendCtx.arc(0.5 * width, 0.2 * height, 0.7 * width, 0, TWO_PI, true);
      trendCtx.closePath();
      trendCtx.fill();
    }
  };

  const drawEquals = function () {
    // draw equal symbol
    const ledColor = colors[1];

    trendCtx.beginPath();
    if (onSection.state === 'steady') {
      fill = ledColor.outerColor_ON;
      trendCtx.fillStyle = fill;
      trendCtx.rect(
        0.128 * width,
        0.41 * height,
        0.744 * width,
        0.074 * height
      );
      trendCtx.rect(
        0.128 * width,
        0.516 * height,
        0.744 * width,
        0.074 * height
      );
      trendCtx.closePath();
      trendCtx.fill();
    } else {
      fill = trendCtx.createLinearGradient(
        0,
        0.41 * height,
        0,
        0.41 * height + 0.074 * height
      );
      fill.addColorStop(0, '#323232');
      fill.addColorStop(1, '#5c5c5c');
      trendCtx.fillStyle = fill;
      trendCtx.rect(
        0.128 * width,
        0.41 * height,
        0.744 * width,
        0.074 * height
      );
      trendCtx.closePath();
      trendCtx.fill();
      fill = trendCtx.createLinearGradient(
        0,
        0.516 * height,
        0,
        0.516 * height + 0.074 * height
      );
      fill.addColorStop(0, '#323232');
      fill.addColorStop(1, '#5c5c5c');
      trendCtx.fillStyle = fill;
      trendCtx.rect(
        0.128 * width,
        0.516 * height,
        0.744 * width,
        0.074 * height
      );
      trendCtx.closePath();
      trendCtx.fill();
    }
    if (onSection.state !== 'steady') {
      // inner shadow
      trendCtx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
      trendCtx.beginPath();
      trendCtx.moveTo(0.128 * width, 0.41 * height + 0.074 * height);
      trendCtx.lineTo(0.128 * width, 0.41 * height);
      trendCtx.lineTo(0.128 * width + 0.744 * width, 0.41 * height);
      trendCtx.stroke();
      trendCtx.beginPath();
      trendCtx.moveTo(0.128 * width, 0.516 * height + 0.074 * height);
      trendCtx.lineTo(0.128 * width, 0.516 * height);
      trendCtx.lineTo(0.128 * width + 0.744 * width, 0.516 * height);
      trendCtx.stroke();
      // inner highlight
      trendCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      trendCtx.beginPath();
      trendCtx.moveTo(0.128 * width + 0.744 * width, 0.41 * height);
      trendCtx.lineTo(
        0.128 * width + 0.744 * width,
        0.41 * height + 0.074 * height
      );
      trendCtx.lineTo(0.128 * width, 0.41 * height + 0.074 * height);
      trendCtx.stroke();
      trendCtx.beginPath();
      trendCtx.moveTo(0.128 * width + 0.744 * width, 0.516 * height);
      trendCtx.lineTo(
        0.128 * width + 0.744 * width,
        0.516 * height + 0.074 * height
      );
      trendCtx.lineTo(0.128 * width, 0.516 * height + 0.074 * height);
      trendCtx.stroke();
    } else {
      // draw halo
      fill = trendCtx.createRadialGradient(
        0.5 * width,
        0.5 * height,
        0,
        0.5 * width,
        0.5 * height,
        0.7 * width
      );
      fill.addColorStop(0, setAlpha(ledColor.coronaColor, 0));
      fill.addColorStop(0.5, setAlpha(ledColor.coronaColor, 0.3));
      fill.addColorStop(0.7, setAlpha(ledColor.coronaColor, 0.2));
      fill.addColorStop(0.8, setAlpha(ledColor.coronaColor, 0.1));
      fill.addColorStop(0.85, setAlpha(ledColor.coronaColor, 0.05));
      fill.addColorStop(1, setAlpha(ledColor.coronaColor, 0));
      trendCtx.fillStyle = fill;
      trendCtx.beginPath();
      trendCtx.arc(0.5 * width, 0.5 * height, 0.7 * width, 0, TWO_PI, true);
      trendCtx.closePath();
      trendCtx.fill();
    }
  };

  const drawDownArrow = function () {
    // draw down arrow
    const ledColor = colors[2];
    if (onSection.state === 'down') {
      fill = trendCtx.createRadialGradient(
        0.5 * width,
        0.8 * height,
        0,
        0.5 * width,
        0.8 * height,
        0.5 * width
      );
      fill.addColorStop(0, ledColor.innerColor1_ON);
      fill.addColorStop(0.2, ledColor.innerColor2_ON);
      fill.addColorStop(1, ledColor.outerColor_ON);
    } else {
      fill = trendCtx.createLinearGradient(0, 0.63 * height, 0, height);
      fill.addColorStop(0, '#323232');
      fill.addColorStop(1, '#5c5c5c');
    }
    trendCtx.beginPath();
    trendCtx.fillStyle = fill;
    trendCtx.moveTo(0.5 * width, height);
    trendCtx.lineTo(width, 0.8 * height);
    trendCtx.lineTo(0.725 * width, 0.8 * height);
    trendCtx.lineTo(0.725 * width, 0.63 * height);
    trendCtx.lineTo(0.252 * width, 0.63 * height);
    trendCtx.lineTo(0.252 * width, 0.8 * height);
    trendCtx.lineTo(0, 0.8 * height);
    trendCtx.closePath();
    trendCtx.fill();
    if (onSection.state !== 'down') {
      // Inner shadow
      trendCtx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
      trendCtx.beginPath();
      trendCtx.moveTo(0, 0.8 * height);
      trendCtx.lineTo(0.252 * width, 0.8 * height);
      trendCtx.moveTo(0.252 * width, 0.63 * height);
      trendCtx.lineTo(0.752 * width, 0.63 * height);
      trendCtx.stroke();
      trendCtx.beginPath();
      trendCtx.moveTo(0.752 * width, 0.8 * height);
      trendCtx.lineTo(width, 0.8 * height);
      trendCtx.stroke();
      // Inner highlight
      trendCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      trendCtx.beginPath();
      trendCtx.moveTo(0, 0.8 * height);
      trendCtx.lineTo(0.5 * width, height);
      trendCtx.lineTo(width, 0.8 * height);
      trendCtx.stroke();
      trendCtx.beginPath();
      trendCtx.moveTo(0.752 * width, 0.8 * height);
      trendCtx.lineTo(0.752 * width, 0.63 * height);
      trendCtx.stroke();
    } else {
      // draw halo
      fill = trendCtx.createRadialGradient(
        0.5 * width,
        0.8 * height,
        0,
        0.5 * width,
        0.8 * height,
        0.7 * width
      );
      fill.addColorStop(0, setAlpha(ledColor.coronaColor, 0));
      fill.addColorStop(0.5, setAlpha(ledColor.coronaColor, 0.3));
      fill.addColorStop(0.7, setAlpha(ledColor.coronaColor, 0.2));
      fill.addColorStop(0.8, setAlpha(ledColor.coronaColor, 0.1));
      fill.addColorStop(0.85, setAlpha(ledColor.coronaColor, 0.05));
      fill.addColorStop(1, setAlpha(ledColor.coronaColor, 0));
      trendCtx.fillStyle = fill;
      trendCtx.beginPath();
      trendCtx.arc(0.5 * width, 0.8 * height, 0.7 * width, 0, TWO_PI, true);
      trendCtx.closePath();
      trendCtx.fill();
    }
  };

  // Check if we have already cached this indicator, if not create it
  if (!createTrendIndicator.cache[cacheKey]) {
    // create oversized buffer for the glow
    trendBuffer = createBuffer(width * 2, width * 4);
    trendCtx = trendBuffer.getContext('2d');
    trendCtx.translate(width * 0.5, width * 0.5);
    // Must draw the active section last so the 'glow' is on top
    switch (onSection.state) {
      case 'up':
        drawDownArrow();
        drawEquals();
        drawUpArrow();
        break
      case 'steady':
        drawDownArrow();
        drawUpArrow();
        drawEquals();
        break
      case 'down':
      /* falls through */
      default:
        drawUpArrow();
        drawEquals();
        drawDownArrow();
        break
    }
    // cache the buffer
    createTrendIndicator.cache[cacheKey] = trendBuffer;
  }
  return createTrendIndicator.cache[cacheKey]
};
createTrendIndicator.cache = {};

const drawTitleImage = function (
  ctx,
  imageWidth,
  imageHeight,
  titleString,
  unitString,
  backgroundColor,
  vertical,
  radial,
  altPos,
  gaugeType
) {
  gaugeType =
    undefined === gaugeType ? (gaugeType = GaugeType.TYPE1) : gaugeType;
  ctx.save();
  ctx.textAlign = radial ? 'center' : 'left';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = backgroundColor.labelColor.getRgbaColor();
  ctx.fillStyle = backgroundColor.labelColor.getRgbaColor();

  if (radial) {
    ctx.font = 0.046728 * imageWidth + 'px ' + stdFontName;
    ctx.fillText(
      titleString,
      imageWidth / 2,
      imageHeight * 0.3,
      imageWidth * 0.3
    );
    ctx.fillText(
      unitString,
      imageWidth / 2,
      imageHeight * 0.38,
      imageWidth * 0.3
    );
  } else {
    // linear
    if (vertical) {
      ctx.font = 0.1 * imageWidth + 'px ' + stdFontName;
      ctx.save();
      ctx.translate(0.671428 * imageWidth, 0.1375 * imageHeight);
      ctx.rotate(1.570796);
      ctx.fillText(titleString, 0, 0);
      ctx.translate(-0.671428 * imageWidth, -0.1375 * imageHeight);
      ctx.restore();
      ctx.font = 0.071428 * imageWidth + 'px ' + stdFontName;
      if (altPos) {
        // LCD visible
        if (gaugeType.type === 'type2') {
          ctx.textAlign = 'right';
          ctx.fillText(
            unitString,
            0.36 * imageWidth,
            imageHeight * 0.79,
            imageWidth * 0.25
          );
        } else {
          ctx.fillText(
            unitString,
            0.63 * imageWidth,
            imageHeight * 0.85,
            imageWidth * 0.2
          );
        }
      } else {
        // LCD hidden
        ctx.textAlign = 'center';
        if (gaugeType.type === 'type2') {
          ctx.fillText(
            unitString,
            imageWidth / 2,
            imageHeight * 0.92,
            imageWidth * 0.2
          );
        } else {
          ctx.fillText(
            unitString,
            imageWidth / 2,
            imageHeight * 0.89,
            imageWidth * 0.2
          );
        }
      }
    } else {
      // linear horizontal
      ctx.font = 0.035 * imageWidth + 'px ' + stdFontName;
      ctx.fillText(
        titleString,
        imageWidth * 0.15,
        imageHeight * 0.25,
        imageWidth * 0.3
      );
      ctx.font = 0.025 * imageWidth + 'px ' + stdFontName;
      ctx.fillText(
        unitString,
        imageWidth * 0.0625,
        imageHeight * 0.7,
        imageWidth * 0.07
      );
    }
  }
  ctx.restore();
};

/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
const t$1=window.ShadowRoot&&(void 0===window.ShadyCSS||window.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,e$2=Symbol(),n$3=new Map;class s$3{constructor(t,n){if(this._$cssResult$=!0,n!==e$2)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t;}get styleSheet(){let e=n$3.get(this.cssText);return t$1&&void 0===e&&(n$3.set(this.cssText,e=new CSSStyleSheet),e.replaceSync(this.cssText)),e}toString(){return this.cssText}}const o$3=t=>new s$3("string"==typeof t?t:t+"",e$2),i$1=(e,n)=>{t$1?e.adoptedStyleSheets=n.map((t=>t instanceof CSSStyleSheet?t:t.styleSheet)):n.forEach((t=>{const n=document.createElement("style"),s=window.litNonce;void 0!==s&&n.setAttribute("nonce",s),n.textContent=t.cssText,e.appendChild(n);}));},S$1=t$1?t=>t:t=>t instanceof CSSStyleSheet?(t=>{let e="";for(const n of t.cssRules)e+=n.cssText;return o$3(e)})(t):t;

/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */var s$2;const e$1=window.trustedTypes,r$1=e$1?e$1.emptyScript:"",h$1=window.reactiveElementPolyfillSupport,o$2={toAttribute(t,i){switch(i){case Boolean:t=t?r$1:null;break;case Object:case Array:t=null==t?t:JSON.stringify(t);}return t},fromAttribute(t,i){let s=t;switch(i){case Boolean:s=null!==t;break;case Number:s=null===t?null:Number(t);break;case Object:case Array:try{s=JSON.parse(t);}catch(t){s=null;}}return s}},n$2=(t,i)=>i!==t&&(i==i||t==t),l$2={attribute:!0,type:String,converter:o$2,reflect:!1,hasChanged:n$2};class a$1 extends HTMLElement{constructor(){super(),this._$Et=new Map,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Ei=null,this.o();}static addInitializer(t){var i;null!==(i=this.l)&&void 0!==i||(this.l=[]),this.l.push(t);}static get observedAttributes(){this.finalize();const t=[];return this.elementProperties.forEach(((i,s)=>{const e=this._$Eh(s,i);void 0!==e&&(this._$Eu.set(e,s),t.push(e));})),t}static createProperty(t,i=l$2){if(i.state&&(i.attribute=!1),this.finalize(),this.elementProperties.set(t,i),!i.noAccessor&&!this.prototype.hasOwnProperty(t)){const s="symbol"==typeof t?Symbol():"__"+t,e=this.getPropertyDescriptor(t,s,i);void 0!==e&&Object.defineProperty(this.prototype,t,e);}}static getPropertyDescriptor(t,i,s){return {get(){return this[i]},set(e){const r=this[t];this[i]=e,this.requestUpdate(t,r,s);},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)||l$2}static finalize(){if(this.hasOwnProperty("finalized"))return !1;this.finalized=!0;const t=Object.getPrototypeOf(this);if(t.finalize(),this.elementProperties=new Map(t.elementProperties),this._$Eu=new Map,this.hasOwnProperty("properties")){const t=this.properties,i=[...Object.getOwnPropertyNames(t),...Object.getOwnPropertySymbols(t)];for(const s of i)this.createProperty(s,t[s]);}return this.elementStyles=this.finalizeStyles(this.styles),!0}static finalizeStyles(i){const s=[];if(Array.isArray(i)){const e=new Set(i.flat(1/0).reverse());for(const i of e)s.unshift(S$1(i));}else void 0!==i&&s.push(S$1(i));return s}static _$Eh(t,i){const s=i.attribute;return !1===s?void 0:"string"==typeof s?s:"string"==typeof t?t.toLowerCase():void 0}o(){var t;this._$Ep=new Promise((t=>this.enableUpdating=t)),this._$AL=new Map,this._$Em(),this.requestUpdate(),null===(t=this.constructor.l)||void 0===t||t.forEach((t=>t(this)));}addController(t){var i,s;(null!==(i=this._$Eg)&&void 0!==i?i:this._$Eg=[]).push(t),void 0!==this.renderRoot&&this.isConnected&&(null===(s=t.hostConnected)||void 0===s||s.call(t));}removeController(t){var i;null===(i=this._$Eg)||void 0===i||i.splice(this._$Eg.indexOf(t)>>>0,1);}_$Em(){this.constructor.elementProperties.forEach(((t,i)=>{this.hasOwnProperty(i)&&(this._$Et.set(i,this[i]),delete this[i]);}));}createRenderRoot(){var t;const s=null!==(t=this.shadowRoot)&&void 0!==t?t:this.attachShadow(this.constructor.shadowRootOptions);return i$1(s,this.constructor.elementStyles),s}connectedCallback(){var t;void 0===this.renderRoot&&(this.renderRoot=this.createRenderRoot()),this.enableUpdating(!0),null===(t=this._$Eg)||void 0===t||t.forEach((t=>{var i;return null===(i=t.hostConnected)||void 0===i?void 0:i.call(t)}));}enableUpdating(t){}disconnectedCallback(){var t;null===(t=this._$Eg)||void 0===t||t.forEach((t=>{var i;return null===(i=t.hostDisconnected)||void 0===i?void 0:i.call(t)}));}attributeChangedCallback(t,i,s){this._$AK(t,s);}_$ES(t,i,s=l$2){var e,r;const h=this.constructor._$Eh(t,s);if(void 0!==h&&!0===s.reflect){const n=(null!==(r=null===(e=s.converter)||void 0===e?void 0:e.toAttribute)&&void 0!==r?r:o$2.toAttribute)(i,s.type);this._$Ei=t,null==n?this.removeAttribute(h):this.setAttribute(h,n),this._$Ei=null;}}_$AK(t,i){var s,e,r;const h=this.constructor,n=h._$Eu.get(t);if(void 0!==n&&this._$Ei!==n){const t=h.getPropertyOptions(n),l=t.converter,a=null!==(r=null!==(e=null===(s=l)||void 0===s?void 0:s.fromAttribute)&&void 0!==e?e:"function"==typeof l?l:null)&&void 0!==r?r:o$2.fromAttribute;this._$Ei=n,this[n]=a(i,t.type),this._$Ei=null;}}requestUpdate(t,i,s){let e=!0;void 0!==t&&(((s=s||this.constructor.getPropertyOptions(t)).hasChanged||n$2)(this[t],i)?(this._$AL.has(t)||this._$AL.set(t,i),!0===s.reflect&&this._$Ei!==t&&(void 0===this._$EC&&(this._$EC=new Map),this._$EC.set(t,s))):e=!1),!this.isUpdatePending&&e&&(this._$Ep=this._$E_());}async _$E_(){this.isUpdatePending=!0;try{await this._$Ep;}catch(t){Promise.reject(t);}const t=this.scheduleUpdate();return null!=t&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){var t;if(!this.isUpdatePending)return;this.hasUpdated,this._$Et&&(this._$Et.forEach(((t,i)=>this[i]=t)),this._$Et=void 0);let i=!1;const s=this._$AL;try{i=this.shouldUpdate(s),i?(this.willUpdate(s),null===(t=this._$Eg)||void 0===t||t.forEach((t=>{var i;return null===(i=t.hostUpdate)||void 0===i?void 0:i.call(t)})),this.update(s)):this._$EU();}catch(t){throw i=!1,this._$EU(),t}i&&this._$AE(s);}willUpdate(t){}_$AE(t){var i;null===(i=this._$Eg)||void 0===i||i.forEach((t=>{var i;return null===(i=t.hostUpdated)||void 0===i?void 0:i.call(t)})),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t);}_$EU(){this._$AL=new Map,this.isUpdatePending=!1;}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$Ep}shouldUpdate(t){return !0}update(t){void 0!==this._$EC&&(this._$EC.forEach(((t,i)=>this._$ES(i,this[i],t))),this._$EC=void 0),this._$EU();}updated(t){}firstUpdated(t){}}a$1.finalized=!0,a$1.elementProperties=new Map,a$1.elementStyles=[],a$1.shadowRootOptions={mode:"open"},null==h$1||h$1({ReactiveElement:a$1}),(null!==(s$2=globalThis.reactiveElementVersions)&&void 0!==s$2?s$2:globalThis.reactiveElementVersions=[]).push("1.3.1");

/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */
var t;const i=globalThis.trustedTypes,s$1=i?i.createPolicy("lit-html",{createHTML:t=>t}):void 0,e=`lit$${(Math.random()+"").slice(9)}$`,o$1="?"+e,n$1=`<${o$1}>`,l$1=document,h=(t="")=>l$1.createComment(t),r=t=>null===t||"object"!=typeof t&&"function"!=typeof t,d=Array.isArray,u=t=>{var i;return d(t)||"function"==typeof(null===(i=t)||void 0===i?void 0:i[Symbol.iterator])},c=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,v=/-->/g,a=/>/g,f=/>|[ 	\n\r](?:([^\s"'>=/]+)([ 	\n\r]*=[ 	\n\r]*(?:[^ 	\n\r"'`<>=]|("|')|))|$)/g,_=/'/g,m=/"/g,g=/^(?:script|style|textarea|title)$/i,p=t=>(i,...s)=>({_$litType$:t,strings:i,values:s}),$=p(1),b=Symbol.for("lit-noChange"),w=Symbol.for("lit-nothing"),T=new WeakMap,x=(t,i,s)=>{var e,o;const n=null!==(e=null==s?void 0:s.renderBefore)&&void 0!==e?e:i;let l=n._$litPart$;if(void 0===l){const t=null!==(o=null==s?void 0:s.renderBefore)&&void 0!==o?o:null;n._$litPart$=l=new N(i.insertBefore(h(),t),t,void 0,null!=s?s:{});}return l._$AI(t),l},A=l$1.createTreeWalker(l$1,129,null,!1),C=(t,i)=>{const o=t.length-1,l=[];let h,r=2===i?"<svg>":"",d=c;for(let i=0;i<o;i++){const s=t[i];let o,u,p=-1,$=0;for(;$<s.length&&(d.lastIndex=$,u=d.exec(s),null!==u);)$=d.lastIndex,d===c?"!--"===u[1]?d=v:void 0!==u[1]?d=a:void 0!==u[2]?(g.test(u[2])&&(h=RegExp("</"+u[2],"g")),d=f):void 0!==u[3]&&(d=f):d===f?">"===u[0]?(d=null!=h?h:c,p=-1):void 0===u[1]?p=-2:(p=d.lastIndex-u[2].length,o=u[1],d=void 0===u[3]?f:'"'===u[3]?m:_):d===m||d===_?d=f:d===v||d===a?d=c:(d=f,h=void 0);const y=d===f&&t[i+1].startsWith("/>")?" ":"";r+=d===c?s+n$1:p>=0?(l.push(o),s.slice(0,p)+"$lit$"+s.slice(p)+e+y):s+e+(-2===p?(l.push(void 0),i):y);}const u=r+(t[o]||"<?>")+(2===i?"</svg>":"");if(!Array.isArray(t)||!t.hasOwnProperty("raw"))throw Error("invalid template strings array");return [void 0!==s$1?s$1.createHTML(u):u,l]};class E{constructor({strings:t,_$litType$:s},n){let l;this.parts=[];let r=0,d=0;const u=t.length-1,c=this.parts,[v,a]=C(t,s);if(this.el=E.createElement(v,n),A.currentNode=this.el.content,2===s){const t=this.el.content,i=t.firstChild;i.remove(),t.append(...i.childNodes);}for(;null!==(l=A.nextNode())&&c.length<u;){if(1===l.nodeType){if(l.hasAttributes()){const t=[];for(const i of l.getAttributeNames())if(i.endsWith("$lit$")||i.startsWith(e)){const s=a[d++];if(t.push(i),void 0!==s){const t=l.getAttribute(s.toLowerCase()+"$lit$").split(e),i=/([.?@])?(.*)/.exec(s);c.push({type:1,index:r,name:i[2],strings:t,ctor:"."===i[1]?M:"?"===i[1]?H:"@"===i[1]?I:S});}else c.push({type:6,index:r});}for(const i of t)l.removeAttribute(i);}if(g.test(l.tagName)){const t=l.textContent.split(e),s=t.length-1;if(s>0){l.textContent=i?i.emptyScript:"";for(let i=0;i<s;i++)l.append(t[i],h()),A.nextNode(),c.push({type:2,index:++r});l.append(t[s],h());}}}else if(8===l.nodeType)if(l.data===o$1)c.push({type:2,index:r});else {let t=-1;for(;-1!==(t=l.data.indexOf(e,t+1));)c.push({type:7,index:r}),t+=e.length-1;}r++;}}static createElement(t,i){const s=l$1.createElement("template");return s.innerHTML=t,s}}function P(t,i,s=t,e){var o,n,l,h;if(i===b)return i;let d=void 0!==e?null===(o=s._$Cl)||void 0===o?void 0:o[e]:s._$Cu;const u=r(i)?void 0:i._$litDirective$;return (null==d?void 0:d.constructor)!==u&&(null===(n=null==d?void 0:d._$AO)||void 0===n||n.call(d,!1),void 0===u?d=void 0:(d=new u(t),d._$AT(t,s,e)),void 0!==e?(null!==(l=(h=s)._$Cl)&&void 0!==l?l:h._$Cl=[])[e]=d:s._$Cu=d),void 0!==d&&(i=P(t,d._$AS(t,i.values),d,e)),i}class V{constructor(t,i){this.v=[],this._$AN=void 0,this._$AD=t,this._$AM=i;}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}p(t){var i;const{el:{content:s},parts:e}=this._$AD,o=(null!==(i=null==t?void 0:t.creationScope)&&void 0!==i?i:l$1).importNode(s,!0);A.currentNode=o;let n=A.nextNode(),h=0,r=0,d=e[0];for(;void 0!==d;){if(h===d.index){let i;2===d.type?i=new N(n,n.nextSibling,this,t):1===d.type?i=new d.ctor(n,d.name,d.strings,this,t):6===d.type&&(i=new L(n,this,t)),this.v.push(i),d=e[++r];}h!==(null==d?void 0:d.index)&&(n=A.nextNode(),h++);}return o}m(t){let i=0;for(const s of this.v)void 0!==s&&(void 0!==s.strings?(s._$AI(t,s,i),i+=s.strings.length-2):s._$AI(t[i])),i++;}}class N{constructor(t,i,s,e){var o;this.type=2,this._$AH=w,this._$AN=void 0,this._$AA=t,this._$AB=i,this._$AM=s,this.options=e,this._$Cg=null===(o=null==e?void 0:e.isConnected)||void 0===o||o;}get _$AU(){var t,i;return null!==(i=null===(t=this._$AM)||void 0===t?void 0:t._$AU)&&void 0!==i?i:this._$Cg}get parentNode(){let t=this._$AA.parentNode;const i=this._$AM;return void 0!==i&&11===t.nodeType&&(t=i.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,i=this){t=P(this,t,i),r(t)?t===w||null==t||""===t?(this._$AH!==w&&this._$AR(),this._$AH=w):t!==this._$AH&&t!==b&&this.$(t):void 0!==t._$litType$?this.T(t):void 0!==t.nodeType?this.k(t):u(t)?this.S(t):this.$(t);}A(t,i=this._$AB){return this._$AA.parentNode.insertBefore(t,i)}k(t){this._$AH!==t&&(this._$AR(),this._$AH=this.A(t));}$(t){this._$AH!==w&&r(this._$AH)?this._$AA.nextSibling.data=t:this.k(l$1.createTextNode(t)),this._$AH=t;}T(t){var i;const{values:s,_$litType$:e}=t,o="number"==typeof e?this._$AC(t):(void 0===e.el&&(e.el=E.createElement(e.h,this.options)),e);if((null===(i=this._$AH)||void 0===i?void 0:i._$AD)===o)this._$AH.m(s);else {const t=new V(o,this),i=t.p(this.options);t.m(s),this.k(i),this._$AH=t;}}_$AC(t){let i=T.get(t.strings);return void 0===i&&T.set(t.strings,i=new E(t)),i}S(t){d(this._$AH)||(this._$AH=[],this._$AR());const i=this._$AH;let s,e=0;for(const o of t)e===i.length?i.push(s=new N(this.A(h()),this.A(h()),this,this.options)):s=i[e],s._$AI(o),e++;e<i.length&&(this._$AR(s&&s._$AB.nextSibling,e),i.length=e);}_$AR(t=this._$AA.nextSibling,i){var s;for(null===(s=this._$AP)||void 0===s||s.call(this,!1,!0,i);t&&t!==this._$AB;){const i=t.nextSibling;t.remove(),t=i;}}setConnected(t){var i;void 0===this._$AM&&(this._$Cg=t,null===(i=this._$AP)||void 0===i||i.call(this,t));}}class S{constructor(t,i,s,e,o){this.type=1,this._$AH=w,this._$AN=void 0,this.element=t,this.name=i,this._$AM=e,this.options=o,s.length>2||""!==s[0]||""!==s[1]?(this._$AH=Array(s.length-1).fill(new String),this.strings=s):this._$AH=w;}get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}_$AI(t,i=this,s,e){const o=this.strings;let n=!1;if(void 0===o)t=P(this,t,i,0),n=!r(t)||t!==this._$AH&&t!==b,n&&(this._$AH=t);else {const e=t;let l,h;for(t=o[0],l=0;l<o.length-1;l++)h=P(this,e[s+l],i,l),h===b&&(h=this._$AH[l]),n||(n=!r(h)||h!==this._$AH[l]),h===w?t=w:t!==w&&(t+=(null!=h?h:"")+o[l+1]),this._$AH[l]=h;}n&&!e&&this.C(t);}C(t){t===w?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,null!=t?t:"");}}class M extends S{constructor(){super(...arguments),this.type=3;}C(t){this.element[this.name]=t===w?void 0:t;}}const k=i?i.emptyScript:"";class H extends S{constructor(){super(...arguments),this.type=4;}C(t){t&&t!==w?this.element.setAttribute(this.name,k):this.element.removeAttribute(this.name);}}class I extends S{constructor(t,i,s,e,o){super(t,i,s,e,o),this.type=5;}_$AI(t,i=this){var s;if((t=null!==(s=P(this,t,i,0))&&void 0!==s?s:w)===b)return;const e=this._$AH,o=t===w&&e!==w||t.capture!==e.capture||t.once!==e.once||t.passive!==e.passive,n=t!==w&&(e===w||o);o&&this.element.removeEventListener(this.name,this,e),n&&this.element.addEventListener(this.name,this,t),this._$AH=t;}handleEvent(t){var i,s;"function"==typeof this._$AH?this._$AH.call(null!==(s=null===(i=this.options)||void 0===i?void 0:i.host)&&void 0!==s?s:this.element,t):this._$AH.handleEvent(t);}}class L{constructor(t,i,s){this.element=t,this.type=6,this._$AN=void 0,this._$AM=i,this.options=s;}get _$AU(){return this._$AM._$AU}_$AI(t){P(this,t);}}const z=window.litHtmlPolyfillSupport;null==z||z(E,N),(null!==(t=globalThis.litHtmlVersions)&&void 0!==t?t:globalThis.litHtmlVersions=[]).push("2.2.1");

/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */var l,o;class s extends a$1{constructor(){super(...arguments),this.renderOptions={host:this},this._$Dt=void 0;}createRenderRoot(){var t,e;const i=super.createRenderRoot();return null!==(t=(e=this.renderOptions).renderBefore)&&void 0!==t||(e.renderBefore=i.firstChild),i}update(t){const i=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Dt=x(i,this.renderRoot,this.renderOptions);}connectedCallback(){var t;super.connectedCallback(),null===(t=this._$Dt)||void 0===t||t.setConnected(!0);}disconnectedCallback(){var t;super.disconnectedCallback(),null===(t=this._$Dt)||void 0===t||t.setConnected(!1);}render(){return b}}s.finalized=!0,s._$litElement$=!0,null===(l=globalThis.litElementHydrateSupport)||void 0===l||l.call(globalThis,{LitElement:s});const n=globalThis.litElementPolyfillSupport;null==n||n({LitElement:s});(null!==(o=globalThis.litElementVersions)&&void 0!==o?o:globalThis.litElementVersions=[]).push("3.2.0");

class BaseElement extends s {
  constructor () {
    super();
    this._properties = this.constructor.properties;
    this._keys = Object.keys(this._properties).filter((k) => !this._properties[k].state);
    for (const key of this._keys) {
      assert('defaultValue' in this._properties[key]);
      this[key] = this._properties[key].defaultValue;
    }
  }

  buildPair (key) {
    let value = this[key];

    // for animations
    const realKey = `real_${key}`;
    if (realKey in this._properties) {
      value = this[realKey];
    }

    if (this._properties[key].type === Boolean && key.startsWith('no')) {
      value = !value;
      key = key.slice(2);
      key = key[0].toLowerCase() + key.slice(1);
    } else if (this._properties[key].objectEnum) {
      const possibilities = new Set(Object.keys(this._properties[key].objectEnum));
      assert(possibilities.has(value), `Unknown value ${value} for key ${key}, possible values are: ${possibilities.keys()}`);
      value = this._properties[key].objectEnum[value];
    }
    return [key, value]
  }

  updated () {
    const canvas = this.renderRoot.querySelector('canvas');
    const drawFunction = this.constructor.drawFunction;
    const params = Object.fromEntries(this._keys.map((el) => this.buildPair(el)));
    drawFunction(canvas, params);
  }
}

const linear$2 = t => +t;

function cubicInOut(t) {
  return ((t *= 2) <= 1 ? t * t * t : (t -= 2) * t * t + 2) / 2;
}

var frame = 0, // is an animation frame pending?
    timeout = 0, // is a timeout pending?
    interval = 0, // are any timers active?
    pokeDelay = 1000, // how frequently we check for clock skew
    taskHead,
    taskTail,
    clockLast = 0,
    clockNow = 0,
    clockSkew = 0,
    clock = typeof performance === "object" && performance.now ? performance : Date,
    setFrame = typeof window === "object" && window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function(f) { setTimeout(f, 17); };

function now() {
  return clockNow || (setFrame(clearNow), clockNow = clock.now() + clockSkew);
}

function clearNow() {
  clockNow = 0;
}

function Timer() {
  this._call =
  this._time =
  this._next = null;
}

Timer.prototype = timer.prototype = {
  constructor: Timer,
  restart: function(callback, delay, time) {
    if (typeof callback !== "function") throw new TypeError("callback is not a function");
    time = (time == null ? now() : +time) + (delay == null ? 0 : +delay);
    if (!this._next && taskTail !== this) {
      if (taskTail) taskTail._next = this;
      else taskHead = this;
      taskTail = this;
    }
    this._call = callback;
    this._time = time;
    sleep();
  },
  stop: function() {
    if (this._call) {
      this._call = null;
      this._time = Infinity;
      sleep();
    }
  }
};

function timer(callback, delay, time) {
  var t = new Timer;
  t.restart(callback, delay, time);
  return t;
}

function timerFlush() {
  now(); // Get the current time, if not already set.
  ++frame; // Pretend we’ve set an alarm, if we haven’t already.
  var t = taskHead, e;
  while (t) {
    if ((e = clockNow - t._time) >= 0) t._call.call(undefined, e);
    t = t._next;
  }
  --frame;
}

function wake() {
  clockNow = (clockLast = clock.now()) + clockSkew;
  frame = timeout = 0;
  try {
    timerFlush();
  } finally {
    frame = 0;
    nap();
    clockNow = 0;
  }
}

function poke() {
  var now = clock.now(), delay = now - clockLast;
  if (delay > pokeDelay) clockSkew -= delay, clockLast = now;
}

function nap() {
  var t0, t1 = taskHead, t2, time = Infinity;
  while (t1) {
    if (t1._call) {
      if (time > t1._time) time = t1._time;
      t0 = t1, t1 = t1._next;
    } else {
      t2 = t1._next, t1._next = null;
      t1 = t0 ? t0._next = t2 : taskHead = t2;
    }
  }
  taskTail = t0;
  sleep(time);
}

function sleep(time) {
  if (frame) return; // Soonest alarm already set, or will be.
  if (timeout) timeout = clearTimeout(timeout);
  var delay = time - clockNow; // Strictly less than if we recomputed clockNow.
  if (delay > 24) {
    if (time < Infinity) timeout = setTimeout(wake, time - clock.now() - clockSkew);
    if (interval) interval = clearInterval(interval);
  } else {
    if (!interval) clockLast = clock.now(), interval = setInterval(poke, pokeDelay);
    frame = 1, setFrame(wake);
  }
}

function ascending(a, b) {
  return a == null || b == null ? NaN : a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
}

function bisector(f) {
  let delta = f;
  let compare1 = f;
  let compare2 = f;

  if (f.length !== 2) {
    delta = (d, x) => f(d) - x;
    compare1 = ascending;
    compare2 = (d, x) => ascending(f(d), x);
  }

  function left(a, x, lo = 0, hi = a.length) {
    if (lo < hi) {
      if (compare1(x, x) !== 0) return hi;
      do {
        const mid = (lo + hi) >>> 1;
        if (compare2(a[mid], x) < 0) lo = mid + 1;
        else hi = mid;
      } while (lo < hi);
    }
    return lo;
  }

  function right(a, x, lo = 0, hi = a.length) {
    if (lo < hi) {
      if (compare1(x, x) !== 0) return hi;
      do {
        const mid = (lo + hi) >>> 1;
        if (compare2(a[mid], x) <= 0) lo = mid + 1;
        else hi = mid;
      } while (lo < hi);
    }
    return lo;
  }

  function center(a, x, lo = 0, hi = a.length) {
    const i = left(a, x, lo, hi - 1);
    return i > lo && delta(a[i - 1], x) > -delta(a[i], x) ? i - 1 : i;
  }

  return {left, center, right};
}

function number$1(x) {
  return x === null ? NaN : +x;
}

const ascendingBisect = bisector(ascending);
const bisectRight = ascendingBisect.right;
bisector(number$1).center;
var bisect = bisectRight;

var e10 = Math.sqrt(50),
    e5 = Math.sqrt(10),
    e2 = Math.sqrt(2);

function ticks(start, stop, count) {
  var reverse,
      i = -1,
      n,
      ticks,
      step;

  stop = +stop, start = +start, count = +count;
  if (start === stop && count > 0) return [start];
  if (reverse = stop < start) n = start, start = stop, stop = n;
  if ((step = tickIncrement(start, stop, count)) === 0 || !isFinite(step)) return [];

  if (step > 0) {
    let r0 = Math.round(start / step), r1 = Math.round(stop / step);
    if (r0 * step < start) ++r0;
    if (r1 * step > stop) --r1;
    ticks = new Array(n = r1 - r0 + 1);
    while (++i < n) ticks[i] = (r0 + i) * step;
  } else {
    step = -step;
    let r0 = Math.round(start * step), r1 = Math.round(stop * step);
    if (r0 / step < start) ++r0;
    if (r1 / step > stop) --r1;
    ticks = new Array(n = r1 - r0 + 1);
    while (++i < n) ticks[i] = (r0 + i) / step;
  }

  if (reverse) ticks.reverse();

  return ticks;
}

function tickIncrement(start, stop, count) {
  var step = (stop - start) / Math.max(0, count),
      power = Math.floor(Math.log(step) / Math.LN10),
      error = step / Math.pow(10, power);
  return power >= 0
      ? (error >= e10 ? 10 : error >= e5 ? 5 : error >= e2 ? 2 : 1) * Math.pow(10, power)
      : -Math.pow(10, -power) / (error >= e10 ? 10 : error >= e5 ? 5 : error >= e2 ? 2 : 1);
}

function tickStep(start, stop, count) {
  var step0 = Math.abs(stop - start) / Math.max(0, count),
      step1 = Math.pow(10, Math.floor(Math.log(step0) / Math.LN10)),
      error = step0 / step1;
  if (error >= e10) step1 *= 10;
  else if (error >= e5) step1 *= 5;
  else if (error >= e2) step1 *= 2;
  return stop < start ? -step1 : step1;
}

function initRange(domain, range) {
  switch (arguments.length) {
    case 0: break;
    case 1: this.range(domain); break;
    default: this.range(range).domain(domain); break;
  }
  return this;
}

function define(constructor, factory, prototype) {
  constructor.prototype = factory.prototype = prototype;
  prototype.constructor = constructor;
}

function extend(parent, definition) {
  var prototype = Object.create(parent.prototype);
  for (var key in definition) prototype[key] = definition[key];
  return prototype;
}

function Color() {}

var darker = 0.7;
var brighter = 1 / darker;

var reI = "\\s*([+-]?\\d+)\\s*",
    reN = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)\\s*",
    reP = "\\s*([+-]?(?:\\d*\\.)?\\d+(?:[eE][+-]?\\d+)?)%\\s*",
    reHex = /^#([0-9a-f]{3,8})$/,
    reRgbInteger = new RegExp(`^rgb\\(${reI},${reI},${reI}\\)$`),
    reRgbPercent = new RegExp(`^rgb\\(${reP},${reP},${reP}\\)$`),
    reRgbaInteger = new RegExp(`^rgba\\(${reI},${reI},${reI},${reN}\\)$`),
    reRgbaPercent = new RegExp(`^rgba\\(${reP},${reP},${reP},${reN}\\)$`),
    reHslPercent = new RegExp(`^hsl\\(${reN},${reP},${reP}\\)$`),
    reHslaPercent = new RegExp(`^hsla\\(${reN},${reP},${reP},${reN}\\)$`);

var named = {
  aliceblue: 0xf0f8ff,
  antiquewhite: 0xfaebd7,
  aqua: 0x00ffff,
  aquamarine: 0x7fffd4,
  azure: 0xf0ffff,
  beige: 0xf5f5dc,
  bisque: 0xffe4c4,
  black: 0x000000,
  blanchedalmond: 0xffebcd,
  blue: 0x0000ff,
  blueviolet: 0x8a2be2,
  brown: 0xa52a2a,
  burlywood: 0xdeb887,
  cadetblue: 0x5f9ea0,
  chartreuse: 0x7fff00,
  chocolate: 0xd2691e,
  coral: 0xff7f50,
  cornflowerblue: 0x6495ed,
  cornsilk: 0xfff8dc,
  crimson: 0xdc143c,
  cyan: 0x00ffff,
  darkblue: 0x00008b,
  darkcyan: 0x008b8b,
  darkgoldenrod: 0xb8860b,
  darkgray: 0xa9a9a9,
  darkgreen: 0x006400,
  darkgrey: 0xa9a9a9,
  darkkhaki: 0xbdb76b,
  darkmagenta: 0x8b008b,
  darkolivegreen: 0x556b2f,
  darkorange: 0xff8c00,
  darkorchid: 0x9932cc,
  darkred: 0x8b0000,
  darksalmon: 0xe9967a,
  darkseagreen: 0x8fbc8f,
  darkslateblue: 0x483d8b,
  darkslategray: 0x2f4f4f,
  darkslategrey: 0x2f4f4f,
  darkturquoise: 0x00ced1,
  darkviolet: 0x9400d3,
  deeppink: 0xff1493,
  deepskyblue: 0x00bfff,
  dimgray: 0x696969,
  dimgrey: 0x696969,
  dodgerblue: 0x1e90ff,
  firebrick: 0xb22222,
  floralwhite: 0xfffaf0,
  forestgreen: 0x228b22,
  fuchsia: 0xff00ff,
  gainsboro: 0xdcdcdc,
  ghostwhite: 0xf8f8ff,
  gold: 0xffd700,
  goldenrod: 0xdaa520,
  gray: 0x808080,
  green: 0x008000,
  greenyellow: 0xadff2f,
  grey: 0x808080,
  honeydew: 0xf0fff0,
  hotpink: 0xff69b4,
  indianred: 0xcd5c5c,
  indigo: 0x4b0082,
  ivory: 0xfffff0,
  khaki: 0xf0e68c,
  lavender: 0xe6e6fa,
  lavenderblush: 0xfff0f5,
  lawngreen: 0x7cfc00,
  lemonchiffon: 0xfffacd,
  lightblue: 0xadd8e6,
  lightcoral: 0xf08080,
  lightcyan: 0xe0ffff,
  lightgoldenrodyellow: 0xfafad2,
  lightgray: 0xd3d3d3,
  lightgreen: 0x90ee90,
  lightgrey: 0xd3d3d3,
  lightpink: 0xffb6c1,
  lightsalmon: 0xffa07a,
  lightseagreen: 0x20b2aa,
  lightskyblue: 0x87cefa,
  lightslategray: 0x778899,
  lightslategrey: 0x778899,
  lightsteelblue: 0xb0c4de,
  lightyellow: 0xffffe0,
  lime: 0x00ff00,
  limegreen: 0x32cd32,
  linen: 0xfaf0e6,
  magenta: 0xff00ff,
  maroon: 0x800000,
  mediumaquamarine: 0x66cdaa,
  mediumblue: 0x0000cd,
  mediumorchid: 0xba55d3,
  mediumpurple: 0x9370db,
  mediumseagreen: 0x3cb371,
  mediumslateblue: 0x7b68ee,
  mediumspringgreen: 0x00fa9a,
  mediumturquoise: 0x48d1cc,
  mediumvioletred: 0xc71585,
  midnightblue: 0x191970,
  mintcream: 0xf5fffa,
  mistyrose: 0xffe4e1,
  moccasin: 0xffe4b5,
  navajowhite: 0xffdead,
  navy: 0x000080,
  oldlace: 0xfdf5e6,
  olive: 0x808000,
  olivedrab: 0x6b8e23,
  orange: 0xffa500,
  orangered: 0xff4500,
  orchid: 0xda70d6,
  palegoldenrod: 0xeee8aa,
  palegreen: 0x98fb98,
  paleturquoise: 0xafeeee,
  palevioletred: 0xdb7093,
  papayawhip: 0xffefd5,
  peachpuff: 0xffdab9,
  peru: 0xcd853f,
  pink: 0xffc0cb,
  plum: 0xdda0dd,
  powderblue: 0xb0e0e6,
  purple: 0x800080,
  rebeccapurple: 0x663399,
  red: 0xff0000,
  rosybrown: 0xbc8f8f,
  royalblue: 0x4169e1,
  saddlebrown: 0x8b4513,
  salmon: 0xfa8072,
  sandybrown: 0xf4a460,
  seagreen: 0x2e8b57,
  seashell: 0xfff5ee,
  sienna: 0xa0522d,
  silver: 0xc0c0c0,
  skyblue: 0x87ceeb,
  slateblue: 0x6a5acd,
  slategray: 0x708090,
  slategrey: 0x708090,
  snow: 0xfffafa,
  springgreen: 0x00ff7f,
  steelblue: 0x4682b4,
  tan: 0xd2b48c,
  teal: 0x008080,
  thistle: 0xd8bfd8,
  tomato: 0xff6347,
  turquoise: 0x40e0d0,
  violet: 0xee82ee,
  wheat: 0xf5deb3,
  white: 0xffffff,
  whitesmoke: 0xf5f5f5,
  yellow: 0xffff00,
  yellowgreen: 0x9acd32
};

define(Color, color, {
  copy(channels) {
    return Object.assign(new this.constructor, this, channels);
  },
  displayable() {
    return this.rgb().displayable();
  },
  hex: color_formatHex, // Deprecated! Use color.formatHex.
  formatHex: color_formatHex,
  formatHex8: color_formatHex8,
  formatHsl: color_formatHsl,
  formatRgb: color_formatRgb,
  toString: color_formatRgb
});

function color_formatHex() {
  return this.rgb().formatHex();
}

function color_formatHex8() {
  return this.rgb().formatHex8();
}

function color_formatHsl() {
  return hslConvert(this).formatHsl();
}

function color_formatRgb() {
  return this.rgb().formatRgb();
}

function color(format) {
  var m, l;
  format = (format + "").trim().toLowerCase();
  return (m = reHex.exec(format)) ? (l = m[1].length, m = parseInt(m[1], 16), l === 6 ? rgbn(m) // #ff0000
      : l === 3 ? new Rgb((m >> 8 & 0xf) | (m >> 4 & 0xf0), (m >> 4 & 0xf) | (m & 0xf0), ((m & 0xf) << 4) | (m & 0xf), 1) // #f00
      : l === 8 ? rgba(m >> 24 & 0xff, m >> 16 & 0xff, m >> 8 & 0xff, (m & 0xff) / 0xff) // #ff000000
      : l === 4 ? rgba((m >> 12 & 0xf) | (m >> 8 & 0xf0), (m >> 8 & 0xf) | (m >> 4 & 0xf0), (m >> 4 & 0xf) | (m & 0xf0), (((m & 0xf) << 4) | (m & 0xf)) / 0xff) // #f000
      : null) // invalid hex
      : (m = reRgbInteger.exec(format)) ? new Rgb(m[1], m[2], m[3], 1) // rgb(255, 0, 0)
      : (m = reRgbPercent.exec(format)) ? new Rgb(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, 1) // rgb(100%, 0%, 0%)
      : (m = reRgbaInteger.exec(format)) ? rgba(m[1], m[2], m[3], m[4]) // rgba(255, 0, 0, 1)
      : (m = reRgbaPercent.exec(format)) ? rgba(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, m[4]) // rgb(100%, 0%, 0%, 1)
      : (m = reHslPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, 1) // hsl(120, 50%, 50%)
      : (m = reHslaPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, m[4]) // hsla(120, 50%, 50%, 1)
      : named.hasOwnProperty(format) ? rgbn(named[format]) // eslint-disable-line no-prototype-builtins
      : format === "transparent" ? new Rgb(NaN, NaN, NaN, 0)
      : null;
}

function rgbn(n) {
  return new Rgb(n >> 16 & 0xff, n >> 8 & 0xff, n & 0xff, 1);
}

function rgba(r, g, b, a) {
  if (a <= 0) r = g = b = NaN;
  return new Rgb(r, g, b, a);
}

function rgbConvert(o) {
  if (!(o instanceof Color)) o = color(o);
  if (!o) return new Rgb;
  o = o.rgb();
  return new Rgb(o.r, o.g, o.b, o.opacity);
}

function rgb$1(r, g, b, opacity) {
  return arguments.length === 1 ? rgbConvert(r) : new Rgb(r, g, b, opacity == null ? 1 : opacity);
}

function Rgb(r, g, b, opacity) {
  this.r = +r;
  this.g = +g;
  this.b = +b;
  this.opacity = +opacity;
}

define(Rgb, rgb$1, extend(Color, {
  brighter(k) {
    k = k == null ? brighter : Math.pow(brighter, k);
    return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
  },
  darker(k) {
    k = k == null ? darker : Math.pow(darker, k);
    return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
  },
  rgb() {
    return this;
  },
  clamp() {
    return new Rgb(clampi(this.r), clampi(this.g), clampi(this.b), clampa(this.opacity));
  },
  displayable() {
    return (-0.5 <= this.r && this.r < 255.5)
        && (-0.5 <= this.g && this.g < 255.5)
        && (-0.5 <= this.b && this.b < 255.5)
        && (0 <= this.opacity && this.opacity <= 1);
  },
  hex: rgb_formatHex, // Deprecated! Use color.formatHex.
  formatHex: rgb_formatHex,
  formatHex8: rgb_formatHex8,
  formatRgb: rgb_formatRgb,
  toString: rgb_formatRgb
}));

function rgb_formatHex() {
  return `#${hex(this.r)}${hex(this.g)}${hex(this.b)}`;
}

function rgb_formatHex8() {
  return `#${hex(this.r)}${hex(this.g)}${hex(this.b)}${hex((isNaN(this.opacity) ? 1 : this.opacity) * 255)}`;
}

function rgb_formatRgb() {
  const a = clampa(this.opacity);
  return `${a === 1 ? "rgb(" : "rgba("}${clampi(this.r)}, ${clampi(this.g)}, ${clampi(this.b)}${a === 1 ? ")" : `, ${a})`}`;
}

function clampa(opacity) {
  return isNaN(opacity) ? 1 : Math.max(0, Math.min(1, opacity));
}

function clampi(value) {
  return Math.max(0, Math.min(255, Math.round(value) || 0));
}

function hex(value) {
  value = clampi(value);
  return (value < 16 ? "0" : "") + value.toString(16);
}

function hsla(h, s, l, a) {
  if (a <= 0) h = s = l = NaN;
  else if (l <= 0 || l >= 1) h = s = NaN;
  else if (s <= 0) h = NaN;
  return new Hsl(h, s, l, a);
}

function hslConvert(o) {
  if (o instanceof Hsl) return new Hsl(o.h, o.s, o.l, o.opacity);
  if (!(o instanceof Color)) o = color(o);
  if (!o) return new Hsl;
  if (o instanceof Hsl) return o;
  o = o.rgb();
  var r = o.r / 255,
      g = o.g / 255,
      b = o.b / 255,
      min = Math.min(r, g, b),
      max = Math.max(r, g, b),
      h = NaN,
      s = max - min,
      l = (max + min) / 2;
  if (s) {
    if (r === max) h = (g - b) / s + (g < b) * 6;
    else if (g === max) h = (b - r) / s + 2;
    else h = (r - g) / s + 4;
    s /= l < 0.5 ? max + min : 2 - max - min;
    h *= 60;
  } else {
    s = l > 0 && l < 1 ? 0 : h;
  }
  return new Hsl(h, s, l, o.opacity);
}

function hsl(h, s, l, opacity) {
  return arguments.length === 1 ? hslConvert(h) : new Hsl(h, s, l, opacity == null ? 1 : opacity);
}

function Hsl(h, s, l, opacity) {
  this.h = +h;
  this.s = +s;
  this.l = +l;
  this.opacity = +opacity;
}

define(Hsl, hsl, extend(Color, {
  brighter(k) {
    k = k == null ? brighter : Math.pow(brighter, k);
    return new Hsl(this.h, this.s, this.l * k, this.opacity);
  },
  darker(k) {
    k = k == null ? darker : Math.pow(darker, k);
    return new Hsl(this.h, this.s, this.l * k, this.opacity);
  },
  rgb() {
    var h = this.h % 360 + (this.h < 0) * 360,
        s = isNaN(h) || isNaN(this.s) ? 0 : this.s,
        l = this.l,
        m2 = l + (l < 0.5 ? l : 1 - l) * s,
        m1 = 2 * l - m2;
    return new Rgb(
      hsl2rgb(h >= 240 ? h - 240 : h + 120, m1, m2),
      hsl2rgb(h, m1, m2),
      hsl2rgb(h < 120 ? h + 240 : h - 120, m1, m2),
      this.opacity
    );
  },
  clamp() {
    return new Hsl(clamph(this.h), clampt(this.s), clampt(this.l), clampa(this.opacity));
  },
  displayable() {
    return (0 <= this.s && this.s <= 1 || isNaN(this.s))
        && (0 <= this.l && this.l <= 1)
        && (0 <= this.opacity && this.opacity <= 1);
  },
  formatHsl() {
    const a = clampa(this.opacity);
    return `${a === 1 ? "hsl(" : "hsla("}${clamph(this.h)}, ${clampt(this.s) * 100}%, ${clampt(this.l) * 100}%${a === 1 ? ")" : `, ${a})`}`;
  }
}));

function clamph(value) {
  value = (value || 0) % 360;
  return value < 0 ? value + 360 : value;
}

function clampt(value) {
  return Math.max(0, Math.min(1, value || 0));
}

/* From FvD 13.37, CSS Color Module Level 3 */
function hsl2rgb(h, m1, m2) {
  return (h < 60 ? m1 + (m2 - m1) * h / 60
      : h < 180 ? m2
      : h < 240 ? m1 + (m2 - m1) * (240 - h) / 60
      : m1) * 255;
}

var constant = x => () => x;

function linear$1(a, d) {
  return function(t) {
    return a + t * d;
  };
}

function exponential(a, b, y) {
  return a = Math.pow(a, y), b = Math.pow(b, y) - a, y = 1 / y, function(t) {
    return Math.pow(a + t * b, y);
  };
}

function gamma(y) {
  return (y = +y) === 1 ? nogamma : function(a, b) {
    return b - a ? exponential(a, b, y) : constant(isNaN(a) ? b : a);
  };
}

function nogamma(a, b) {
  var d = b - a;
  return d ? linear$1(a, d) : constant(isNaN(a) ? b : a);
}

var rgb = (function rgbGamma(y) {
  var color = gamma(y);

  function rgb(start, end) {
    var r = color((start = rgb$1(start)).r, (end = rgb$1(end)).r),
        g = color(start.g, end.g),
        b = color(start.b, end.b),
        opacity = nogamma(start.opacity, end.opacity);
    return function(t) {
      start.r = r(t);
      start.g = g(t);
      start.b = b(t);
      start.opacity = opacity(t);
      return start + "";
    };
  }

  rgb.gamma = rgbGamma;

  return rgb;
})(1);

function numberArray(a, b) {
  if (!b) b = [];
  var n = a ? Math.min(b.length, a.length) : 0,
      c = b.slice(),
      i;
  return function(t) {
    for (i = 0; i < n; ++i) c[i] = a[i] * (1 - t) + b[i] * t;
    return c;
  };
}

function isNumberArray(x) {
  return ArrayBuffer.isView(x) && !(x instanceof DataView);
}

function genericArray(a, b) {
  var nb = b ? b.length : 0,
      na = a ? Math.min(nb, a.length) : 0,
      x = new Array(na),
      c = new Array(nb),
      i;

  for (i = 0; i < na; ++i) x[i] = interpolate(a[i], b[i]);
  for (; i < nb; ++i) c[i] = b[i];

  return function(t) {
    for (i = 0; i < na; ++i) c[i] = x[i](t);
    return c;
  };
}

function date(a, b) {
  var d = new Date;
  return a = +a, b = +b, function(t) {
    return d.setTime(a * (1 - t) + b * t), d;
  };
}

function interpolateNumber(a, b) {
  return a = +a, b = +b, function(t) {
    return a * (1 - t) + b * t;
  };
}

function object(a, b) {
  var i = {},
      c = {},
      k;

  if (a === null || typeof a !== "object") a = {};
  if (b === null || typeof b !== "object") b = {};

  for (k in b) {
    if (k in a) {
      i[k] = interpolate(a[k], b[k]);
    } else {
      c[k] = b[k];
    }
  }

  return function(t) {
    for (k in i) c[k] = i[k](t);
    return c;
  };
}

var reA = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g,
    reB = new RegExp(reA.source, "g");

function zero(b) {
  return function() {
    return b;
  };
}

function one(b) {
  return function(t) {
    return b(t) + "";
  };
}

function string(a, b) {
  var bi = reA.lastIndex = reB.lastIndex = 0, // scan index for next number in b
      am, // current match in a
      bm, // current match in b
      bs, // string preceding current number in b, if any
      i = -1, // index in s
      s = [], // string constants and placeholders
      q = []; // number interpolators

  // Coerce inputs to strings.
  a = a + "", b = b + "";

  // Interpolate pairs of numbers in a & b.
  while ((am = reA.exec(a))
      && (bm = reB.exec(b))) {
    if ((bs = bm.index) > bi) { // a string precedes the next number in b
      bs = b.slice(bi, bs);
      if (s[i]) s[i] += bs; // coalesce with previous string
      else s[++i] = bs;
    }
    if ((am = am[0]) === (bm = bm[0])) { // numbers in a & b match
      if (s[i]) s[i] += bm; // coalesce with previous string
      else s[++i] = bm;
    } else { // interpolate non-matching numbers
      s[++i] = null;
      q.push({i: i, x: interpolateNumber(am, bm)});
    }
    bi = reB.lastIndex;
  }

  // Add remains of b.
  if (bi < b.length) {
    bs = b.slice(bi);
    if (s[i]) s[i] += bs; // coalesce with previous string
    else s[++i] = bs;
  }

  // Special optimization for only a single match.
  // Otherwise, interpolate each of the numbers and rejoin the string.
  return s.length < 2 ? (q[0]
      ? one(q[0].x)
      : zero(b))
      : (b = q.length, function(t) {
          for (var i = 0, o; i < b; ++i) s[(o = q[i]).i] = o.x(t);
          return s.join("");
        });
}

function interpolate(a, b) {
  var t = typeof b, c;
  return b == null || t === "boolean" ? constant(b)
      : (t === "number" ? interpolateNumber
      : t === "string" ? ((c = color(b)) ? (b = c, rgb) : string)
      : b instanceof color ? rgb
      : b instanceof Date ? date
      : isNumberArray(b) ? numberArray
      : Array.isArray(b) ? genericArray
      : typeof b.valueOf !== "function" && typeof b.toString !== "function" || isNaN(b) ? object
      : interpolateNumber)(a, b);
}

function interpolateRound(a, b) {
  return a = +a, b = +b, function(t) {
    return Math.round(a * (1 - t) + b * t);
  };
}

function constants(x) {
  return function() {
    return x;
  };
}

function number(x) {
  return +x;
}

var unit = [0, 1];

function identity$1(x) {
  return x;
}

function normalize(a, b) {
  return (b -= (a = +a))
      ? function(x) { return (x - a) / b; }
      : constants(isNaN(b) ? NaN : 0.5);
}

function clamper(a, b) {
  var t;
  if (a > b) t = a, a = b, b = t;
  return function(x) { return Math.max(a, Math.min(b, x)); };
}

// normalize(a, b)(x) takes a domain value x in [a,b] and returns the corresponding parameter t in [0,1].
// interpolate(a, b)(t) takes a parameter t in [0,1] and returns the corresponding range value x in [a,b].
function bimap(domain, range, interpolate) {
  var d0 = domain[0], d1 = domain[1], r0 = range[0], r1 = range[1];
  if (d1 < d0) d0 = normalize(d1, d0), r0 = interpolate(r1, r0);
  else d0 = normalize(d0, d1), r0 = interpolate(r0, r1);
  return function(x) { return r0(d0(x)); };
}

function polymap(domain, range, interpolate) {
  var j = Math.min(domain.length, range.length) - 1,
      d = new Array(j),
      r = new Array(j),
      i = -1;

  // Reverse descending domains.
  if (domain[j] < domain[0]) {
    domain = domain.slice().reverse();
    range = range.slice().reverse();
  }

  while (++i < j) {
    d[i] = normalize(domain[i], domain[i + 1]);
    r[i] = interpolate(range[i], range[i + 1]);
  }

  return function(x) {
    var i = bisect(domain, x, 1, j) - 1;
    return r[i](d[i](x));
  };
}

function copy(source, target) {
  return target
      .domain(source.domain())
      .range(source.range())
      .interpolate(source.interpolate())
      .clamp(source.clamp())
      .unknown(source.unknown());
}

function transformer() {
  var domain = unit,
      range = unit,
      interpolate$1 = interpolate,
      transform,
      untransform,
      unknown,
      clamp = identity$1,
      piecewise,
      output,
      input;

  function rescale() {
    var n = Math.min(domain.length, range.length);
    if (clamp !== identity$1) clamp = clamper(domain[0], domain[n - 1]);
    piecewise = n > 2 ? polymap : bimap;
    output = input = null;
    return scale;
  }

  function scale(x) {
    return x == null || isNaN(x = +x) ? unknown : (output || (output = piecewise(domain.map(transform), range, interpolate$1)))(transform(clamp(x)));
  }

  scale.invert = function(y) {
    return clamp(untransform((input || (input = piecewise(range, domain.map(transform), interpolateNumber)))(y)));
  };

  scale.domain = function(_) {
    return arguments.length ? (domain = Array.from(_, number), rescale()) : domain.slice();
  };

  scale.range = function(_) {
    return arguments.length ? (range = Array.from(_), rescale()) : range.slice();
  };

  scale.rangeRound = function(_) {
    return range = Array.from(_), interpolate$1 = interpolateRound, rescale();
  };

  scale.clamp = function(_) {
    return arguments.length ? (clamp = _ ? true : identity$1, rescale()) : clamp !== identity$1;
  };

  scale.interpolate = function(_) {
    return arguments.length ? (interpolate$1 = _, rescale()) : interpolate$1;
  };

  scale.unknown = function(_) {
    return arguments.length ? (unknown = _, scale) : unknown;
  };

  return function(t, u) {
    transform = t, untransform = u;
    return rescale();
  };
}

function continuous() {
  return transformer()(identity$1, identity$1);
}

function formatDecimal(x) {
  return Math.abs(x = Math.round(x)) >= 1e21
      ? x.toLocaleString("en").replace(/,/g, "")
      : x.toString(10);
}

// Computes the decimal coefficient and exponent of the specified number x with
// significant digits p, where x is positive and p is in [1, 21] or undefined.
// For example, formatDecimalParts(1.23) returns ["123", 0].
function formatDecimalParts(x, p) {
  if ((i = (x = p ? x.toExponential(p - 1) : x.toExponential()).indexOf("e")) < 0) return null; // NaN, ±Infinity
  var i, coefficient = x.slice(0, i);

  // The string returned by toExponential either has the form \d\.\d+e[-+]\d+
  // (e.g., 1.2e+3) or the form \de[-+]\d+ (e.g., 1e+3).
  return [
    coefficient.length > 1 ? coefficient[0] + coefficient.slice(2) : coefficient,
    +x.slice(i + 1)
  ];
}

function exponent(x) {
  return x = formatDecimalParts(Math.abs(x)), x ? x[1] : NaN;
}

function formatGroup(grouping, thousands) {
  return function(value, width) {
    var i = value.length,
        t = [],
        j = 0,
        g = grouping[0],
        length = 0;

    while (i > 0 && g > 0) {
      if (length + g + 1 > width) g = Math.max(1, width - length);
      t.push(value.substring(i -= g, i + g));
      if ((length += g + 1) > width) break;
      g = grouping[j = (j + 1) % grouping.length];
    }

    return t.reverse().join(thousands);
  };
}

function formatNumerals(numerals) {
  return function(value) {
    return value.replace(/[0-9]/g, function(i) {
      return numerals[+i];
    });
  };
}

// [[fill]align][sign][symbol][0][width][,][.precision][~][type]
var re = /^(?:(.)?([<>=^]))?([+\-( ])?([$#])?(0)?(\d+)?(,)?(\.\d+)?(~)?([a-z%])?$/i;

function formatSpecifier(specifier) {
  if (!(match = re.exec(specifier))) throw new Error("invalid format: " + specifier);
  var match;
  return new FormatSpecifier({
    fill: match[1],
    align: match[2],
    sign: match[3],
    symbol: match[4],
    zero: match[5],
    width: match[6],
    comma: match[7],
    precision: match[8] && match[8].slice(1),
    trim: match[9],
    type: match[10]
  });
}

formatSpecifier.prototype = FormatSpecifier.prototype; // instanceof

function FormatSpecifier(specifier) {
  this.fill = specifier.fill === undefined ? " " : specifier.fill + "";
  this.align = specifier.align === undefined ? ">" : specifier.align + "";
  this.sign = specifier.sign === undefined ? "-" : specifier.sign + "";
  this.symbol = specifier.symbol === undefined ? "" : specifier.symbol + "";
  this.zero = !!specifier.zero;
  this.width = specifier.width === undefined ? undefined : +specifier.width;
  this.comma = !!specifier.comma;
  this.precision = specifier.precision === undefined ? undefined : +specifier.precision;
  this.trim = !!specifier.trim;
  this.type = specifier.type === undefined ? "" : specifier.type + "";
}

FormatSpecifier.prototype.toString = function() {
  return this.fill
      + this.align
      + this.sign
      + this.symbol
      + (this.zero ? "0" : "")
      + (this.width === undefined ? "" : Math.max(1, this.width | 0))
      + (this.comma ? "," : "")
      + (this.precision === undefined ? "" : "." + Math.max(0, this.precision | 0))
      + (this.trim ? "~" : "")
      + this.type;
};

// Trims insignificant zeros, e.g., replaces 1.2000k with 1.2k.
function formatTrim(s) {
  out: for (var n = s.length, i = 1, i0 = -1, i1; i < n; ++i) {
    switch (s[i]) {
      case ".": i0 = i1 = i; break;
      case "0": if (i0 === 0) i0 = i; i1 = i; break;
      default: if (!+s[i]) break out; if (i0 > 0) i0 = 0; break;
    }
  }
  return i0 > 0 ? s.slice(0, i0) + s.slice(i1 + 1) : s;
}

var prefixExponent;

function formatPrefixAuto(x, p) {
  var d = formatDecimalParts(x, p);
  if (!d) return x + "";
  var coefficient = d[0],
      exponent = d[1],
      i = exponent - (prefixExponent = Math.max(-8, Math.min(8, Math.floor(exponent / 3))) * 3) + 1,
      n = coefficient.length;
  return i === n ? coefficient
      : i > n ? coefficient + new Array(i - n + 1).join("0")
      : i > 0 ? coefficient.slice(0, i) + "." + coefficient.slice(i)
      : "0." + new Array(1 - i).join("0") + formatDecimalParts(x, Math.max(0, p + i - 1))[0]; // less than 1y!
}

function formatRounded(x, p) {
  var d = formatDecimalParts(x, p);
  if (!d) return x + "";
  var coefficient = d[0],
      exponent = d[1];
  return exponent < 0 ? "0." + new Array(-exponent).join("0") + coefficient
      : coefficient.length > exponent + 1 ? coefficient.slice(0, exponent + 1) + "." + coefficient.slice(exponent + 1)
      : coefficient + new Array(exponent - coefficient.length + 2).join("0");
}

var formatTypes = {
  "%": (x, p) => (x * 100).toFixed(p),
  "b": (x) => Math.round(x).toString(2),
  "c": (x) => x + "",
  "d": formatDecimal,
  "e": (x, p) => x.toExponential(p),
  "f": (x, p) => x.toFixed(p),
  "g": (x, p) => x.toPrecision(p),
  "o": (x) => Math.round(x).toString(8),
  "p": (x, p) => formatRounded(x * 100, p),
  "r": formatRounded,
  "s": formatPrefixAuto,
  "X": (x) => Math.round(x).toString(16).toUpperCase(),
  "x": (x) => Math.round(x).toString(16)
};

function identity(x) {
  return x;
}

var map = Array.prototype.map,
    prefixes = ["y","z","a","f","p","n","µ","m","","k","M","G","T","P","E","Z","Y"];

function formatLocale(locale) {
  var group = locale.grouping === undefined || locale.thousands === undefined ? identity : formatGroup(map.call(locale.grouping, Number), locale.thousands + ""),
      currencyPrefix = locale.currency === undefined ? "" : locale.currency[0] + "",
      currencySuffix = locale.currency === undefined ? "" : locale.currency[1] + "",
      decimal = locale.decimal === undefined ? "." : locale.decimal + "",
      numerals = locale.numerals === undefined ? identity : formatNumerals(map.call(locale.numerals, String)),
      percent = locale.percent === undefined ? "%" : locale.percent + "",
      minus = locale.minus === undefined ? "−" : locale.minus + "",
      nan = locale.nan === undefined ? "NaN" : locale.nan + "";

  function newFormat(specifier) {
    specifier = formatSpecifier(specifier);

    var fill = specifier.fill,
        align = specifier.align,
        sign = specifier.sign,
        symbol = specifier.symbol,
        zero = specifier.zero,
        width = specifier.width,
        comma = specifier.comma,
        precision = specifier.precision,
        trim = specifier.trim,
        type = specifier.type;

    // The "n" type is an alias for ",g".
    if (type === "n") comma = true, type = "g";

    // The "" type, and any invalid type, is an alias for ".12~g".
    else if (!formatTypes[type]) precision === undefined && (precision = 12), trim = true, type = "g";

    // If zero fill is specified, padding goes after sign and before digits.
    if (zero || (fill === "0" && align === "=")) zero = true, fill = "0", align = "=";

    // Compute the prefix and suffix.
    // For SI-prefix, the suffix is lazily computed.
    var prefix = symbol === "$" ? currencyPrefix : symbol === "#" && /[boxX]/.test(type) ? "0" + type.toLowerCase() : "",
        suffix = symbol === "$" ? currencySuffix : /[%p]/.test(type) ? percent : "";

    // What format function should we use?
    // Is this an integer type?
    // Can this type generate exponential notation?
    var formatType = formatTypes[type],
        maybeSuffix = /[defgprs%]/.test(type);

    // Set the default precision if not specified,
    // or clamp the specified precision to the supported range.
    // For significant precision, it must be in [1, 21].
    // For fixed precision, it must be in [0, 20].
    precision = precision === undefined ? 6
        : /[gprs]/.test(type) ? Math.max(1, Math.min(21, precision))
        : Math.max(0, Math.min(20, precision));

    function format(value) {
      var valuePrefix = prefix,
          valueSuffix = suffix,
          i, n, c;

      if (type === "c") {
        valueSuffix = formatType(value) + valueSuffix;
        value = "";
      } else {
        value = +value;

        // Determine the sign. -0 is not less than 0, but 1 / -0 is!
        var valueNegative = value < 0 || 1 / value < 0;

        // Perform the initial formatting.
        value = isNaN(value) ? nan : formatType(Math.abs(value), precision);

        // Trim insignificant zeros.
        if (trim) value = formatTrim(value);

        // If a negative value rounds to zero after formatting, and no explicit positive sign is requested, hide the sign.
        if (valueNegative && +value === 0 && sign !== "+") valueNegative = false;

        // Compute the prefix and suffix.
        valuePrefix = (valueNegative ? (sign === "(" ? sign : minus) : sign === "-" || sign === "(" ? "" : sign) + valuePrefix;
        valueSuffix = (type === "s" ? prefixes[8 + prefixExponent / 3] : "") + valueSuffix + (valueNegative && sign === "(" ? ")" : "");

        // Break the formatted value into the integer “value” part that can be
        // grouped, and fractional or exponential “suffix” part that is not.
        if (maybeSuffix) {
          i = -1, n = value.length;
          while (++i < n) {
            if (c = value.charCodeAt(i), 48 > c || c > 57) {
              valueSuffix = (c === 46 ? decimal + value.slice(i + 1) : value.slice(i)) + valueSuffix;
              value = value.slice(0, i);
              break;
            }
          }
        }
      }

      // If the fill character is not "0", grouping is applied before padding.
      if (comma && !zero) value = group(value, Infinity);

      // Compute the padding.
      var length = valuePrefix.length + value.length + valueSuffix.length,
          padding = length < width ? new Array(width - length + 1).join(fill) : "";

      // If the fill character is "0", grouping is applied after padding.
      if (comma && zero) value = group(padding + value, padding.length ? width - valueSuffix.length : Infinity), padding = "";

      // Reconstruct the final output based on the desired alignment.
      switch (align) {
        case "<": value = valuePrefix + value + valueSuffix + padding; break;
        case "=": value = valuePrefix + padding + value + valueSuffix; break;
        case "^": value = padding.slice(0, length = padding.length >> 1) + valuePrefix + value + valueSuffix + padding.slice(length); break;
        default: value = padding + valuePrefix + value + valueSuffix; break;
      }

      return numerals(value);
    }

    format.toString = function() {
      return specifier + "";
    };

    return format;
  }

  function formatPrefix(specifier, value) {
    var f = newFormat((specifier = formatSpecifier(specifier), specifier.type = "f", specifier)),
        e = Math.max(-8, Math.min(8, Math.floor(exponent(value) / 3))) * 3,
        k = Math.pow(10, -e),
        prefix = prefixes[8 + e / 3];
    return function(value) {
      return f(k * value) + prefix;
    };
  }

  return {
    format: newFormat,
    formatPrefix: formatPrefix
  };
}

var locale;
var format;
var formatPrefix;

defaultLocale({
  thousands: ",",
  grouping: [3],
  currency: ["$", ""]
});

function defaultLocale(definition) {
  locale = formatLocale(definition);
  format = locale.format;
  formatPrefix = locale.formatPrefix;
  return locale;
}

function precisionFixed(step) {
  return Math.max(0, -exponent(Math.abs(step)));
}

function precisionPrefix(step, value) {
  return Math.max(0, Math.max(-8, Math.min(8, Math.floor(exponent(value) / 3))) * 3 - exponent(Math.abs(step)));
}

function precisionRound(step, max) {
  step = Math.abs(step), max = Math.abs(max) - step;
  return Math.max(0, exponent(max) - exponent(step)) + 1;
}

function tickFormat(start, stop, count, specifier) {
  var step = tickStep(start, stop, count),
      precision;
  specifier = formatSpecifier(specifier == null ? ",f" : specifier);
  switch (specifier.type) {
    case "s": {
      var value = Math.max(Math.abs(start), Math.abs(stop));
      if (specifier.precision == null && !isNaN(precision = precisionPrefix(step, value))) specifier.precision = precision;
      return formatPrefix(specifier, value);
    }
    case "":
    case "e":
    case "g":
    case "p":
    case "r": {
      if (specifier.precision == null && !isNaN(precision = precisionRound(step, Math.max(Math.abs(start), Math.abs(stop))))) specifier.precision = precision - (specifier.type === "e");
      break;
    }
    case "f":
    case "%": {
      if (specifier.precision == null && !isNaN(precision = precisionFixed(step))) specifier.precision = precision - (specifier.type === "%") * 2;
      break;
    }
  }
  return format(specifier);
}

function linearish(scale) {
  var domain = scale.domain;

  scale.ticks = function(count) {
    var d = domain();
    return ticks(d[0], d[d.length - 1], count == null ? 10 : count);
  };

  scale.tickFormat = function(count, specifier) {
    var d = domain();
    return tickFormat(d[0], d[d.length - 1], count == null ? 10 : count, specifier);
  };

  scale.nice = function(count) {
    if (count == null) count = 10;

    var d = domain();
    var i0 = 0;
    var i1 = d.length - 1;
    var start = d[i0];
    var stop = d[i1];
    var prestep;
    var step;
    var maxIter = 10;

    if (stop < start) {
      step = start, start = stop, stop = step;
      step = i0, i0 = i1, i1 = step;
    }
    
    while (maxIter-- > 0) {
      step = tickIncrement(start, stop, count);
      if (step === prestep) {
        d[i0] = start;
        d[i1] = stop;
        return domain(d);
      } else if (step > 0) {
        start = Math.floor(start / step) * step;
        stop = Math.ceil(stop / step) * step;
      } else if (step < 0) {
        start = Math.ceil(start * step) / step;
        stop = Math.floor(stop * step) / step;
      } else {
        break;
      }
      prestep = step;
    }

    return scale;
  };

  return scale;
}

function linear() {
  var scale = continuous();

  scale.copy = function() {
    return copy(scale, linear());
  };

  initRange.apply(scale, arguments);

  return linearish(scale);
}

function drawOdometer (canvas, parameters) {
  parameters = parameters || {};

  // parameters
  const _context =
    undefined === parameters._context ? null : parameters._context;
  let height = undefined === parameters.height ? 0 : parameters.height;
  const digits = undefined === parameters.digits ? 6 : parameters.digits;
  const decimals = undefined === parameters.decimals ? 1 : parameters.decimals;
  const decimalBackColor =
    undefined === parameters.decimalBackColor
      ? '#F0F0F0'
      : parameters.decimalBackColor;
  const decimalForeColor =
    undefined === parameters.decimalForeColor
      ? '#F01010'
      : parameters.decimalForeColor;
  const font = undefined === parameters.font ? 'sans-serif' : parameters.font;
  let value = undefined === parameters.value ? 0 : parameters.value;
  const valueBackColor =
    undefined === parameters.valueBackColor
      ? '#050505'
      : parameters.valueBackColor;
  const valueForeColor =
    undefined === parameters.valueForeColor
      ? '#F8F8F8'
      : parameters.valueForeColor;
  const wobbleFactor =
    undefined === parameters.wobbleFactor ? 0 : parameters.wobbleFactor;
  //
  let initialized = false;
  let ctx;
  const wobble = [];
  // End of variables

  // Get the canvas context and clear it
  if (_context) {
    ctx = _context;
  } else {
    ctx = getCanvasContext(canvas);
  }

  // Has a height been specified?
  if (height === 0) {
    height = ctx.canvas.height;
  }

  // Cannot display negative values yet
  if (value < 0) {
    value = 0;
  }

  const digitHeight = Math.floor(height * 0.85);
  const stdFont = '600 ' + digitHeight + 'px ' + font;

  const digitWidth = Math.floor(height * 0.68);
  const width = digitWidth * (digits + decimals);
  const columnHeight = digitHeight * 11;
  const verticalSpace = columnHeight / 12;
  const zeroOffset = verticalSpace * 0.81;

  // Resize and clear the main context
  ctx.canvas.width = width;
  ctx.canvas.height = height;

  // Create buffers
  const backgroundBuffer = createBuffer(width, height);
  const backgroundContext = backgroundBuffer.getContext('2d');

  const foregroundBuffer = createBuffer(width, height);
  const foregroundContext = foregroundBuffer.getContext('2d');

  const digitBuffer = createBuffer(digitWidth, columnHeight * 1.1);
  const digitContext = digitBuffer.getContext('2d');

  const decimalBuffer = createBuffer(digitWidth, columnHeight * 1.1);
  const decimalContext = decimalBuffer.getContext('2d');

  function init () {
    let i;

    initialized = true;

    // Create the foreground
    foregroundContext.rect(0, 0, width, height);
    const grad = foregroundContext.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
    grad.addColorStop(0.1, 'rgba(0, 0, 0, 0.4)');
    grad.addColorStop(0.33, 'rgba(255, 255, 255, 0.45)');
    grad.addColorStop(0.46, 'rgba(255, 255, 255, 0)');
    grad.addColorStop(0.9, 'rgba(0, 0, 0, 0.4)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 1)');
    foregroundContext.fillStyle = grad;
    foregroundContext.fill();

    // Create a digit column
    // background
    digitContext.rect(0, 0, digitWidth, columnHeight * 1.1);
    digitContext.fillStyle = valueBackColor;
    digitContext.fill();
    // edges
    digitContext.strokeStyle = '#f0f0f0';
    digitContext.lineWidth = '1px'; // height * 0.1 + 'px';
    digitContext.moveTo(0, 0);
    digitContext.lineTo(0, columnHeight * 1.1);
    digitContext.stroke();
    digitContext.strokeStyle = '#202020';
    digitContext.moveTo(digitWidth, 0);
    digitContext.lineTo(digitWidth, columnHeight * 1.1);
    digitContext.stroke();
    // numerals
    digitContext.textAlign = 'center';
    digitContext.textBaseline = 'middle';
    digitContext.font = stdFont;
    digitContext.fillStyle = valueForeColor;
    // put the digits 901234567890 vertically into the buffer
    for (i = 9; i < 21; i++) {
      digitContext.fillText(
        i % 10,
        digitWidth * 0.5,
        verticalSpace * (i - 9) + verticalSpace / 2
      );
    }

    // Create a decimal column
    if (decimals > 0) {
      // background
      decimalContext.rect(0, 0, digitWidth, columnHeight * 1.1);
      decimalContext.fillStyle = decimalBackColor;
      decimalContext.fill();
      // edges
      decimalContext.strokeStyle = '#f0f0f0';
      decimalContext.lineWidth = '1px'; // height * 0.1 + 'px';
      decimalContext.moveTo(0, 0);
      decimalContext.lineTo(0, columnHeight * 1.1);
      decimalContext.stroke();
      decimalContext.strokeStyle = '#202020';
      decimalContext.moveTo(digitWidth, 0);
      decimalContext.lineTo(digitWidth, columnHeight * 1.1);
      decimalContext.stroke();
      // numerals
      decimalContext.textAlign = 'center';
      decimalContext.textBaseline = 'middle';
      decimalContext.font = stdFont;
      decimalContext.fillStyle = decimalForeColor;
      // put the digits 901234567890 vertically into the buffer
      for (i = 9; i < 21; i++) {
        decimalContext.fillText(
          i % 10,
          digitWidth * 0.5,
          verticalSpace * (i - 9) + verticalSpace / 2
        );
      }
    }
    // wobble factors
    for (i = 0; i < digits + decimals; i++) {
      wobble[i] =
        Math.random() * wobbleFactor * height - (wobbleFactor * height) / 2;
    }
  }

  function drawDigits () {
    let pos = 1;
    let val = value;
    let i;
    let num;
    let numb;
    let frac;
    let prevNum;

    // do not use Math.pow() - rounding errors!
    for (i = 0; i < decimals; i++) {
      val *= 10;
    }

    numb = Math.floor(val);
    frac = val - numb;
    numb = String(numb);
    prevNum = 9;

    for (i = 0; i < decimals + digits; i++) {
      num = +numb.substring(numb.length - i - 1, numb.length - i) || 0;
      if (prevNum !== 9) {
        frac = 0;
      }
      if (i < decimals) {
        backgroundContext.drawImage(
          decimalBuffer,
          width - digitWidth * pos,
          -(verticalSpace * (num + frac) + zeroOffset + wobble[i])
        );
      } else {
        backgroundContext.drawImage(
          digitBuffer,
          width - digitWidth * pos,
          -(verticalSpace * (num + frac) + zeroOffset + wobble[i])
        );
      }
      pos++;
      prevNum = num;
    }
  }

  const repaint = function () {
    if (!initialized) {
      init();
    }

    // draw digits
    drawDigits();

    // draw the foreground
    backgroundContext.drawImage(foregroundBuffer, 0, 0);

    // paint back to the main context
    ctx.drawImage(backgroundBuffer, 0, 0);
  };

  repaint();
}

class OdometerElement extends BaseElement {
  static get drawFunction () { return drawOdometer }

  static get properties () {
    return {
      height: { type: Number, defaultValue: 50 },
      value: { type: Number, defaultValue: 0 },
      real_value: { state: true },
      transitionTime: { type: Number, defaultValue: 500 },
      digits: { type: Number, defaultValue: 6 },
      decimals: { type: Number, defaultValue: 1 },
      decimalBackColor: { type: String, defaultValue: '#F0F0F0' },
      decimalForeColor: { type: String, defaultValue: '#F01010' },
      font: { type: String, defaultValue: 'sans-serif' },
      valueBackColor: { type: String, defaultValue: '#050505' },
      valueForeColor: { type: String, defaultValue: '#F8F8F8' }
    }
  }

  constructor () {
    super();
    this._timer = timer(() => {});
    this._timer.stop();
  }

  connectedCallback () {
    super.connectedCallback();
    this.real_value = this.real_value ?? 0;
  }

  render () {
    return $`
      <canvas width="${this.width}" height="${this.height}"></canvas>
    `
  }

  updated (changedProperties) {
    super.updated();
    if (changedProperties.has('value') || changedProperties.has('transitionTime')) {
      const transitionTime = this.transitionTime;
      const originTime = now();
      const originValue = this.real_value;
      const targetValue = this.value;
      const timeScale = transitionTime <= 0 ? () => 1 : linear().domain([0, transitionTime]).clamp(true);
      const valueScale = linear().range([originValue, targetValue]).clamp(true);
      this._timer.restart((elapsedTime) => {
        const scaled = timeScale(elapsedTime);
        const eased = linear$2(scaled);
        const newValue = valueScale(eased);
        this.real_value = newValue;
        if (now() >= originTime + transitionTime) {
          this._timer.stop();
        }
      });
    }
  }
}

window.customElements.define('steelseries-odometer', OdometerElement);

function drawRadial (canvas, parameters) {
  parameters = parameters || {};
  const gaugeType =
    undefined === parameters.gaugeType ? GaugeType.TYPE4 : parameters.gaugeType;
  let size = undefined === parameters.size ? 0 : parameters.size;
  let minValue = undefined === parameters.minValue ? 0 : parameters.minValue;
  let maxValue =
    undefined === parameters.maxValue ? minValue + 100 : parameters.maxValue;
  const niceScale =
    undefined === parameters.niceScale ? true : parameters.niceScale;
  let threshold =
    undefined === parameters.threshold
      ? (maxValue - minValue) / 2 + minValue
      : parameters.threshold;
  const section = undefined === parameters.section ? null : parameters.section;
  const area = undefined === parameters.area ? null : parameters.area;
  const titleString =
    undefined === parameters.titleString ? '' : parameters.titleString;
  const unitString =
    undefined === parameters.unitString ? '' : parameters.unitString;
  const frameDesign =
    undefined === parameters.frameDesign
      ? FrameDesign.METAL
      : parameters.frameDesign;
  const frameVisible =
    undefined === parameters.frameVisible ? true : parameters.frameVisible;
  const backgroundColor =
    undefined === parameters.backgroundColor
      ? BackgroundColor.DARK_GRAY
      : parameters.backgroundColor;
  const backgroundVisible =
    undefined === parameters.backgroundVisible
      ? true
      : parameters.backgroundVisible;
  const pointerType =
    undefined === parameters.pointerType
      ? PointerType.TYPE1
      : parameters.pointerType;
  const pointerColor =
    undefined === parameters.pointerColor
      ? Color$1.RED
      : parameters.pointerColor;
  const knobType =
    undefined === parameters.knobType
      ? KnobType.STANDARD_KNOB
      : parameters.knobType;
  const knobStyle =
    undefined === parameters.knobStyle
      ? KnobStyle.SILVER
      : parameters.knobStyle;
  const lcdColor =
    undefined === parameters.lcdColor ? LcdColor.STANDARD : parameters.lcdColor;
  const lcdVisible =
    undefined === parameters.lcdVisible ? true : parameters.lcdVisible;
  const lcdDecimals =
    undefined === parameters.lcdDecimals ? 2 : parameters.lcdDecimals;
  const digitalFont =
    undefined === parameters.digitalFont ? false : parameters.digitalFont;
  const fractionalScaleDecimals =
    undefined === parameters.fractionalScaleDecimals
      ? 1
      : parameters.fractionalScaleDecimals;
  const ledColor =
    undefined === parameters.ledColor ? LedColor.RED_LED : parameters.ledColor;
  const ledVisible =
    undefined === parameters.ledVisible ? false : parameters.ledVisible;
  const userLedColor =
    undefined === parameters.userLedColor
      ? LedColor.GREEN_LED
      : parameters.userLedColor;
  const userLedVisible =
    undefined === parameters.userLedVisible ? false : parameters.userLedVisible;
  const thresholdVisible =
    undefined === parameters.thresholdVisible
      ? true
      : parameters.thresholdVisible;
  const minMeasuredValueVisible =
    undefined === parameters.minMeasuredValueVisible
      ? false
      : parameters.minMeasuredValueVisible;
  const maxMeasuredValueVisible =
    undefined === parameters.maxMeasuredValueVisible
      ? false
      : parameters.maxMeasuredValueVisible;
  const foregroundType =
    undefined === parameters.foregroundType
      ? ForegroundType.TYPE1
      : parameters.foregroundType;
  const foregroundVisible =
    undefined === parameters.foregroundVisible
      ? true
      : parameters.foregroundVisible;
  const labelNumberFormat =
    undefined === parameters.labelNumberFormat
      ? LabelNumberFormat.STANDARD
      : parameters.labelNumberFormat;
  const playAlarm =
    undefined === parameters.playAlarm ? false : parameters.playAlarm;
  const alarmSound =
    undefined === parameters.alarmSound ? false : parameters.alarmSound;
  const customLayer =
    undefined === parameters.customLayer ? null : parameters.customLayer;
  const tickLabelOrientation =
    undefined === parameters.tickLabelOrientation
      ? gaugeType === GaugeType.TYPE1
        ? TickLabelOrientation.TANGENT
        : TickLabelOrientation.NORMAL
      : parameters.tickLabelOrientation;
  const trendVisible =
    undefined === parameters.trendVisible ? false : parameters.trendVisible;
  const trendColors =
    undefined === parameters.trendColors
      ? [LedColor.RED_LED, LedColor.GREEN_LED, LedColor.CYAN_LED]
      : parameters.trendColors;
  const useOdometer =
    undefined === parameters.useOdometer ? false : parameters.useOdometer;
  const odometerParams =
    undefined === parameters.odometerParams ? {} : parameters.odometerParams;

  // Get the canvas context and clear it
  const mainCtx = getCanvasContext(canvas);
  // Has a size been specified?
  if (size === 0) {
    size = Math.min(mainCtx.canvas.width, mainCtx.canvas.height);
  }

  // Set the size - also clears the canvas
  mainCtx.canvas.width = size;
  mainCtx.canvas.height = size;

  // Create audio tag for alarm sound
  let audioElement;
  if (playAlarm && alarmSound !== false) {
    audioElement = doc.createElement('audio');
    audioElement.setAttribute('src', alarmSound);
    audioElement.setAttribute('preload', 'auto');
  }

  let value = parameters.value ?? minValue;

  // Properties
  let minMeasuredValue = maxValue;
  let maxMeasuredValue = minValue;

  const trendIndicator = TrendState.OFF;
  const trendSize = size * 0.06;
  const trendPosX = size * 0.29;
  const trendPosY = size * 0.36;

  // GaugeType specific private variables
  let freeAreaAngle;
  let rotationOffset;
  let angleRange;
  let angleStep;

  let angle = rotationOffset + (value - minValue) * angleStep;

  const imageWidth = size;
  const imageHeight = size;

  const centerX = imageWidth / 2;
  const centerY = imageHeight / 2;

  // Misc
  const ledSize = size * 0.093457;
  const ledPosX = 0.6 * imageWidth;
  const ledPosY = 0.4 * imageHeight;
  const userLedPosX =
    gaugeType === GaugeType.TYPE3 ? 0.6 * imageWidth : centerX - ledSize / 2;
  const userLedPosY =
    gaugeType === GaugeType.TYPE3 ? 0.72 * imageHeight : 0.75 * imageHeight;
  const lcdFontHeight = Math.floor(imageWidth / 10);
  const stdFont = lcdFontHeight + 'px ' + stdFontName;
  const lcdFont = lcdFontHeight + 'px ' + lcdFontName;
  const lcdHeight = imageHeight * 0.13;
  const lcdWidth = imageWidth * 0.4;
  const lcdPosX = (imageWidth - lcdWidth) / 2;
  const lcdPosY = imageHeight * 0.57;
  let odoPosX;
  const odoPosY = imageHeight * 0.61;
  const shadowOffset = imageWidth * 0.006;

  // Constants
  let initialized = false;

  // Tickmark specific private variables
  let niceMinValue = minValue;
  let niceMaxValue = maxValue;
  let niceRange = maxValue - minValue;
  let range = niceMaxValue - niceMinValue;
  let minorTickSpacing = 0;
  let majorTickSpacing = 0;
  const maxNoOfMinorTicks = 10;
  const maxNoOfMajorTicks = 10;

  // Method to calculate nice values for min, max and range for the tickmarks
  const calculate = function calculate () {
    if (niceScale) {
      niceRange = calcNiceNumber(maxValue - minValue, false);
      majorTickSpacing = calcNiceNumber(
        niceRange / (maxNoOfMajorTicks - 1),
        true
      );
      niceMinValue = Math.floor(minValue / majorTickSpacing) * majorTickSpacing;
      niceMaxValue = Math.ceil(maxValue / majorTickSpacing) * majorTickSpacing;
      minorTickSpacing = calcNiceNumber(
        majorTickSpacing / (maxNoOfMinorTicks - 1),
        true
      );
      minValue = niceMinValue;
      maxValue = niceMaxValue;
      range = maxValue - minValue;
    } else {
      niceRange = maxValue - minValue;
      niceMinValue = minValue;
      niceMaxValue = maxValue;
      range = niceRange;
      majorTickSpacing = calcNiceNumber(
        niceRange / (maxNoOfMajorTicks - 1),
        true
      );
      minorTickSpacing = calcNiceNumber(
        majorTickSpacing / (maxNoOfMinorTicks - 1),
        true
      );
    }
    // Make sure values are still in range
    value = value < minValue ? minValue : value > maxValue ? maxValue : value;
    minMeasuredValue =
      minMeasuredValue < minValue
        ? minValue
        : minMeasuredValue > maxValue
          ? maxValue
          : minMeasuredValue;
    maxMeasuredValue =
      maxMeasuredValue < minValue
        ? minValue
        : maxMeasuredValue > maxValue
          ? maxValue
          : maxMeasuredValue;
    threshold =
      threshold < minValue
        ? minValue
        : threshold > maxValue
          ? maxValue
          : threshold;

    switch (gaugeType.type) {
      case 'type1':
        freeAreaAngle = 0;
        rotationOffset = PI;
        angleRange = HALF_PI;
        angleStep = angleRange / range;
        break

      case 'type2':
        freeAreaAngle = 0;
        rotationOffset = PI;
        angleRange = PI;
        angleStep = angleRange / range;
        break

      case 'type3':
        freeAreaAngle = 0;
        rotationOffset = HALF_PI;
        angleRange = 1.5 * PI;
        angleStep = angleRange / range;
        break

      case 'type4':
      /* falls through */
      default:
        freeAreaAngle = 60 * RAD_FACTOR;
        rotationOffset = HALF_PI + freeAreaAngle / 2;
        angleRange = TWO_PI - freeAreaAngle;
        angleStep = angleRange / range;
        break
    }
    angle = rotationOffset + (value - minValue) * angleStep;
  };

  // **************   Buffer creation  ********************
  // Buffer for the frame
  const frameBuffer = createBuffer(size, size);
  const frameContext = frameBuffer.getContext('2d');

  // Buffer for the background
  const backgroundBuffer = createBuffer(size, size);
  const backgroundContext = backgroundBuffer.getContext('2d');

  let lcdBuffer;

  // Buffer for led on painting code
  const ledBufferOn = createBuffer(ledSize, ledSize);
  const ledContextOn = ledBufferOn.getContext('2d');

  // Buffer for led off painting code
  const ledBufferOff = createBuffer(ledSize, ledSize);
  const ledContextOff = ledBufferOff.getContext('2d');

  // Buffer for current led painting code
  const ledBuffer = ledBufferOff;

  // Buffer for user led on painting code
  const userLedBufferOn = createBuffer(ledSize, ledSize);
  const userLedContextOn = userLedBufferOn.getContext('2d');

  // Buffer for user led off painting code
  const userLedBufferOff = createBuffer(ledSize, ledSize);
  const userLedContextOff = userLedBufferOff.getContext('2d');

  // Buffer for current user led painting code
  const userLedBuffer = userLedBufferOff;

  // Buffer for the minMeasuredValue indicator
  const minMeasuredValueBuffer = createBuffer(
    Math.ceil(size * 0.028037),
    Math.ceil(size * 0.028037)
  );
  const minMeasuredValueCtx = minMeasuredValueBuffer.getContext('2d');

  // Buffer for the maxMeasuredValue indicator
  const maxMeasuredValueBuffer = createBuffer(
    Math.ceil(size * 0.028037),
    Math.ceil(size * 0.028037)
  );
  const maxMeasuredValueCtx = maxMeasuredValueBuffer.getContext('2d');

  // Buffer for pointer image painting code
  const pointerBuffer = createBuffer(size, size);
  const pointerContext = pointerBuffer.getContext('2d');

  // Buffer for static foreground painting code
  const foregroundBuffer = createBuffer(size, size);
  const foregroundContext = foregroundBuffer.getContext('2d');

  // Buffers for trend indicators
  let trendUpBuffer;
  let trendSteadyBuffer;
  let trendDownBuffer;
  let trendOffBuffer;

  // Buffer for odometer
  let odoBuffer;
  let odoContext;
  if (useOdometer && lcdVisible) {
    odoBuffer = createBuffer(10, 10); // size doesn't matter, it will get reset by odometer code
    odoContext = odoBuffer.getContext('2d');
  }

  // **************   Image creation  ********************
  const drawLcdText = function (ctx, value) {
    ctx.restore();
    ctx.save();
    ctx.textAlign = 'right';
    ctx.strokeStyle = lcdColor.textColor;
    ctx.fillStyle = lcdColor.textColor;

    if (
      lcdColor === LcdColor.STANDARD ||
      lcdColor === LcdColor.STANDARD_GREEN
    ) {
      ctx.shadowColor = 'gray';
      ctx.shadowOffsetX = imageWidth * 0.007;
      ctx.shadowOffsetY = imageWidth * 0.007;
      ctx.shadowBlur = imageWidth * 0.007;
    }
    if (digitalFont) {
      ctx.font = lcdFont;
    } else {
      ctx.font = stdFont;
    }
    ctx.fillText(
      value.toFixed(lcdDecimals),
      lcdPosX + lcdWidth - lcdWidth * 0.05,
      lcdPosY + lcdHeight * 0.5 + lcdFontHeight * 0.38,
      lcdWidth * 0.9
    );

    ctx.restore();
  };

  const drawPostsImage = function (ctx) {
    ctx.save();

    if (gaugeType.type === 'type1') {
      // Draw max center top post
      ctx.drawImage(
        createKnobImage(
          Math.ceil(imageHeight * 0.037383),
          KnobType.STANDARD_KNOB,
          knobStyle
        ),
        imageWidth * 0.523364,
        imageHeight * 0.130841
      );
    }

    if (gaugeType.type === 'type1' || gaugeType.type === 'type2') {
      // Draw min left post
      ctx.drawImage(
        createKnobImage(
          Math.ceil(imageHeight * 0.037383),
          KnobType.STANDARD_KNOB,
          knobStyle
        ),
        imageWidth * 0.130841,
        imageHeight * 0.514018
      );
    }

    if (gaugeType.type === 'type2' || gaugeType.type === 'type3') {
      // Draw max right post
      ctx.drawImage(
        createKnobImage(
          Math.ceil(imageHeight * 0.037383),
          KnobType.STANDARD_KNOB,
          knobStyle
        ),
        imageWidth * 0.831775,
        imageHeight * 0.514018
      );
    }

    if (gaugeType.type === 'type3') {
      // Draw min center bottom post
      ctx.drawImage(
        createKnobImage(
          Math.ceil(imageHeight * 0.037383),
          KnobType.STANDARD_KNOB,
          knobStyle
        ),
        imageWidth * 0.523364,
        imageHeight * 0.831775
      );
    }

    if (gaugeType.type === 'type4') {
      // Min post
      ctx.drawImage(
        createKnobImage(
          Math.ceil(imageHeight * 0.037383),
          KnobType.STANDARD_KNOB,
          knobStyle
        ),
        imageWidth * 0.336448,
        imageHeight * 0.803738
      );

      // Max post
      ctx.drawImage(
        createKnobImage(
          Math.ceil(imageHeight * 0.037383),
          KnobType.STANDARD_KNOB,
          knobStyle
        ),
        imageWidth * 0.626168,
        imageHeight * 0.803738
      );
    }

    ctx.restore();
  };

  const createThresholdImage = function () {
    const thresholdBuffer = doc.createElement('canvas');
    thresholdBuffer.width = Math.ceil(size * 0.046728);
    thresholdBuffer.height = Math.ceil(thresholdBuffer.width * 0.9);
    const thresholdCtx = thresholdBuffer.getContext('2d');

    thresholdCtx.save();
    const gradThreshold = thresholdCtx.createLinearGradient(
      0,
      0.1,
      0,
      thresholdBuffer.height * 0.9
    );
    gradThreshold.addColorStop(0, '#520000');
    gradThreshold.addColorStop(0.3, '#fc1d00');
    gradThreshold.addColorStop(0.59, '#fc1d00');
    gradThreshold.addColorStop(1, '#520000');
    thresholdCtx.fillStyle = gradThreshold;

    thresholdCtx.beginPath();
    thresholdCtx.moveTo(thresholdBuffer.width * 0.5, 0.1);
    thresholdCtx.lineTo(
      thresholdBuffer.width * 0.9,
      thresholdBuffer.height * 0.9
    );
    thresholdCtx.lineTo(
      thresholdBuffer.width * 0.1,
      thresholdBuffer.height * 0.9
    );
    thresholdCtx.lineTo(thresholdBuffer.width * 0.5, 0.1);
    thresholdCtx.closePath();

    thresholdCtx.fill();
    thresholdCtx.strokeStyle = '#FFFFFF';
    thresholdCtx.stroke();

    thresholdCtx.restore();

    return thresholdBuffer
  };

  const drawAreaSectionImage = function (ctx, start, stop, color, filled) {
    if (start < minValue) {
      start = minValue;
    } else if (start > maxValue) {
      start = maxValue;
    }
    if (stop < minValue) {
      stop = minValue;
    } else if (stop > maxValue) {
      stop = maxValue;
    }
    if (start >= stop) {
      return
    }
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = imageWidth * 0.035;
    const startAngle =
      (angleRange / range) * start - (angleRange / range) * minValue;
    const stopAngle = startAngle + (stop - start) / (range / angleRange);
    ctx.translate(centerX, centerY);
    ctx.rotate(rotationOffset);
    ctx.beginPath();
    if (filled) {
      ctx.moveTo(0, 0);
      ctx.arc(
        0,
        0,
        imageWidth * 0.365 - ctx.lineWidth / 2,
        startAngle,
        stopAngle,
        false
      );
    } else {
      ctx.arc(0, 0, imageWidth * 0.365, startAngle, stopAngle, false);
    }
    if (filled) {
      ctx.moveTo(0, 0);
      ctx.fill();
    } else {
      ctx.stroke();
    }

    ctx.translate(-centerX, -centerY);
    ctx.restore();
  };

  const drawTickmarksImage = function (ctx, labelNumberFormat) {
    const fontSize = Math.ceil(imageWidth * 0.04);
    let alpha = rotationOffset; // Tracks total rotation
    const rotationStep = angleStep * minorTickSpacing;
    let textRotationAngle;
    let valueCounter = minValue;
    let majorTickCounter = maxNoOfMinorTicks - 1;
    const OUTER_POINT = imageWidth * 0.38;
    const MAJOR_INNER_POINT = imageWidth * 0.35;
    const MED_INNER_POINT = imageWidth * 0.355;
    const MINOR_INNER_POINT = imageWidth * 0.36;
    const TEXT_TRANSLATE_X = imageWidth * 0.3;
    let TEXT_WIDTH = imageWidth * 0.1;
    const HALF_MAX_NO_OF_MINOR_TICKS = maxNoOfMinorTicks / 2;
    const MAX_VALUE_ROUNDED = parseFloat(maxValue.toFixed(2));
    let i;

    backgroundColor.labelColor.setAlpha(1);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = fontSize + 'px ' + stdFontName;
    ctx.strokeStyle = backgroundColor.labelColor.getRgbaColor();
    ctx.fillStyle = backgroundColor.labelColor.getRgbaColor();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotationOffset);

    if (gaugeType.type === 'type1' || gaugeType.type === 'type2') {
      TEXT_WIDTH = imageWidth * 0.04;
    }

    for (
      i = minValue;
      parseFloat(i.toFixed(2)) <= MAX_VALUE_ROUNDED;
      i += minorTickSpacing
    ) {
      textRotationAngle = rotationStep + HALF_PI;
      majorTickCounter++;
      // Draw major tickmarks
      if (majorTickCounter === maxNoOfMinorTicks) {
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(OUTER_POINT, 0);
        ctx.lineTo(MAJOR_INNER_POINT, 0);
        ctx.closePath();
        ctx.stroke();
        ctx.save();
        ctx.translate(TEXT_TRANSLATE_X, 0);

        switch (tickLabelOrientation.type) {
          case 'horizontal':
            textRotationAngle = -alpha;
            break

          case 'tangent':
            textRotationAngle = alpha <= HALF_PI + PI ? PI : 0;
            break

          case 'normal':
          /* falls through */
          default:
            textRotationAngle = HALF_PI;
            break
        }
        ctx.rotate(textRotationAngle);

        switch (labelNumberFormat.format) {
          case 'fractional':
            ctx.fillText(
              valueCounter.toFixed(fractionalScaleDecimals),
              0,
              0,
              TEXT_WIDTH
            );
            break

          case 'scientific':
            ctx.fillText(valueCounter.toPrecision(2), 0, 0, TEXT_WIDTH);
            break

          case 'standard':
          /* falls through */
          default:
            ctx.fillText(valueCounter.toFixed(0), 0, 0, TEXT_WIDTH);
            break
        }
        ctx.translate(-TEXT_TRANSLATE_X, 0);
        ctx.restore();

        valueCounter += majorTickSpacing;
        majorTickCounter = 0;
        ctx.rotate(rotationStep);
        alpha += rotationStep;
        continue
      }

      // Draw tickmark every minor tickmark spacing
      if (
        majorTickCounter === HALF_MAX_NO_OF_MINOR_TICKS
      ) {
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(OUTER_POINT, 0);
        ctx.lineTo(MED_INNER_POINT, 0);
        ctx.closePath();
        ctx.stroke();
      } else {
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(OUTER_POINT, 0);
        ctx.lineTo(MINOR_INNER_POINT, 0);
        ctx.closePath();
        ctx.stroke();
      }
      ctx.rotate(rotationStep);
      alpha += rotationStep;
    }

    ctx.translate(-centerX, -centerY);
    ctx.restore();
  };

  // **************   Initialization  ********************
  // Draw all static painting code to background
  const init = function (parameters) {
    parameters = parameters || {};
    const drawFrame2 =
      undefined === parameters.frame ? false : parameters.frame;
    const drawBackground2 =
      undefined === parameters.background ? false : parameters.background;
    const drawLed = undefined === parameters.led ? false : parameters.led;
    const drawUserLed =
      undefined === parameters.userLed ? false : parameters.userLed;
    const drawPointer =
      undefined === parameters.pointer ? false : parameters.pointer;
    const drawForeground2 =
      undefined === parameters.foreground ? false : parameters.foreground;
    const drawTrend = undefined === parameters.trend ? false : parameters.trend;
    const drawOdo = undefined === parameters.odo ? false : parameters.odo;

    initialized = true;

    // Calculate the current min and max values and the range
    calculate();

    // Create frame in frame buffer (backgroundBuffer)
    if (drawFrame2 && frameVisible) {
      drawFrame(
        frameContext,
        frameDesign,
        centerX,
        centerY,
        imageWidth,
        imageHeight
      );
    }

    // Create background in background buffer (backgroundBuffer)
    if (drawBackground2 && backgroundVisible) {
      drawBackground(
        backgroundContext,
        backgroundColor,
        centerX,
        centerY,
        imageWidth,
        imageHeight
      );

      // Create custom layer in background buffer (backgroundBuffer)
      drawRadialCustomImage(
        backgroundContext,
        customLayer,
        centerX,
        centerY,
        imageWidth,
        imageHeight
      );
    }

    if (drawLed) {
      // Draw LED ON in ledBuffer_ON
      ledContextOn.drawImage(
        createLedImage(Math.ceil(size * 0.093457), 1, ledColor),
        0,
        0
      );

      // Draw LED OFF in ledBuffer_OFF
      ledContextOff.drawImage(
        createLedImage(Math.ceil(size * 0.093457), 0, ledColor),
        0,
        0
      );
    }

    if (drawUserLed) {
      // Draw user LED ON in userLedBuffer_ON
      userLedContextOn.drawImage(
        createLedImage(Math.ceil(size * 0.093457), 1, userLedColor),
        0,
        0
      );

      // Draw user LED OFF in userLedBuffer_OFF
      userLedContextOff.drawImage(
        createLedImage(Math.ceil(size * 0.093457), 0, userLedColor),
        0,
        0
      );
    }

    // Draw min measured value indicator in minMeasuredValueBuffer
    if (minMeasuredValueVisible) {
      minMeasuredValueCtx.drawImage(
        createMeasuredValueImage(
          Math.ceil(size * 0.028037),
          Color$1.BLUE.dark.getRgbaColor(),
          true,
          true
        ),
        0,
        0
      );
    }

    // Draw max measured value indicator in maxMeasuredValueBuffer
    if (maxMeasuredValueVisible) {
      maxMeasuredValueCtx.drawImage(
        createMeasuredValueImage(
          Math.ceil(size * 0.028037),
          Color$1.RED.medium.getRgbaColor(),
          true
        ),
        0,
        0
      );
    }

    // Create alignment posts in background buffer (backgroundBuffer)
    if (drawBackground2 && backgroundVisible) {
      drawPostsImage(backgroundContext);

      // Create section in background buffer (backgroundBuffer)
      if (section !== null && section.length > 0) {
        let sectionIndex = section.length;
        do {
          sectionIndex--;
          drawAreaSectionImage(
            backgroundContext,
            section[sectionIndex].start,
            section[sectionIndex].stop,
            section[sectionIndex].color,
            false
          );
        } while (sectionIndex > 0)
      }

      // Create area in background buffer (backgroundBuffer)
      if (area !== null && area.length > 0) {
        let areaIndex = area.length;
        do {
          areaIndex--;
          drawAreaSectionImage(
            backgroundContext,
            area[areaIndex].start,
            area[areaIndex].stop,
            area[areaIndex].color,
            true
          );
        } while (areaIndex > 0)
      }

      // Create tickmarks in background buffer (backgroundBuffer)
      drawTickmarksImage(backgroundContext, labelNumberFormat);

      // Create title in background buffer (backgroundBuffer)
      drawTitleImage(
        backgroundContext,
        imageWidth,
        imageHeight,
        titleString,
        unitString,
        backgroundColor,
        true,
        true
      );
    }

    // Draw threshold image to background context
    if (drawBackground2 && thresholdVisible) {
      backgroundContext.save();
      backgroundContext.translate(centerX, centerY);
      backgroundContext.rotate(
        rotationOffset + (threshold - minValue) * angleStep + HALF_PI
      );
      backgroundContext.translate(-centerX, -centerY);
      backgroundContext.drawImage(
        createThresholdImage(),
        imageWidth * 0.475,
        imageHeight * 0.13
      );
      backgroundContext.translate(centerX, centerY);
      backgroundContext.restore();
    }

    // Create lcd background if selected in background buffer (backgroundBuffer)
    if (drawBackground2 && lcdVisible) {
      if (useOdometer && drawOdo) {
        drawOdometer('', {
          _context: odoContext,
          height: size * 0.075,
          decimals: odometerParams.decimals,
          digits:
            odometerParams.digits === undefined ? 5 : odometerParams.digits,
          valueForeColor: odometerParams.valueForeColor,
          valueBackColor: odometerParams.valueBackColor,
          decimalForeColor: odometerParams.decimalForeColor,
          decimalBackColor: odometerParams.decimalBackColor,
          font: odometerParams.font,
          value: value
        });
        odoPosX = (imageWidth - odoBuffer.width) / 2;
      } else if (!useOdometer) {
        lcdBuffer = createLcdBackgroundImage(lcdWidth, lcdHeight, lcdColor);
        backgroundContext.drawImage(lcdBuffer, lcdPosX, lcdPosY);
      }
    }

    // Create pointer image in pointer buffer (contentBuffer)
    if (drawPointer) {
      drawPointerImage(
        pointerContext,
        imageWidth,
        pointerType,
        pointerColor,
        backgroundColor.labelColor
      );
    }

    // Create foreground in foreground buffer (foregroundBuffer)
    if (drawForeground2 && foregroundVisible) {
      const knobVisible =
        !(pointerType.type === 'type15' || pointerType.type === 'type16');
      drawForeground(
        foregroundContext,
        foregroundType,
        imageWidth,
        imageHeight,
        knobVisible,
        knobType,
        knobStyle,
        gaugeType
      );
    }

    // Create the trend indicator buffers
    if (drawTrend && trendVisible) {
      trendUpBuffer = createTrendIndicator(
        trendSize,
        TrendState.UP,
        trendColors
      );
      trendSteadyBuffer = createTrendIndicator(
        trendSize,
        TrendState.STEADY,
        trendColors
      );
      trendDownBuffer = createTrendIndicator(
        trendSize,
        TrendState.DOWN,
        trendColors
      );
      trendOffBuffer = createTrendIndicator(
        trendSize,
        TrendState.OFF,
        trendColors
      );
    }
  };

  const repaint = function () {
    if (!initialized) {
      init({
        frame: true,
        background: true,
        led: true,
        userLed: true,
        pointer: true,
        trend: true,
        foreground: true,
        odo: true
      });
    }
    mainCtx.clearRect(0, 0, size, size);

    // Draw frame
    if (frameVisible) {
      mainCtx.drawImage(frameBuffer, 0, 0);
    }

    // Draw buffered image to visible canvas
    mainCtx.drawImage(backgroundBuffer, 0, 0);

    // Draw lcd display
    if (lcdVisible) {
      if (useOdometer) {
        mainCtx.drawImage(odoBuffer, odoPosX, odoPosY);
      } else {
        drawLcdText(mainCtx, value);
      }
    }

    // Draw led
    if (ledVisible) {
      mainCtx.drawImage(ledBuffer, ledPosX, ledPosY);
    }

    // Draw user led
    if (userLedVisible) {
      mainCtx.drawImage(userLedBuffer, userLedPosX, userLedPosY);
    }

    // Draw the trend indicator
    if (trendVisible) {
      switch (trendIndicator.state) {
        case 'up':
          mainCtx.drawImage(trendUpBuffer, trendPosX, trendPosY);
          break
        case 'steady':
          mainCtx.drawImage(trendSteadyBuffer, trendPosX, trendPosY);
          break
        case 'down':
          mainCtx.drawImage(trendDownBuffer, trendPosX, trendPosY);
          break
        case 'off':
          mainCtx.drawImage(trendOffBuffer, trendPosX, trendPosY);
          break
      }
    }

    // Draw min measured value indicator
    if (minMeasuredValueVisible) {
      mainCtx.save();
      mainCtx.translate(centerX, centerY);
      mainCtx.rotate(
        rotationOffset + HALF_PI + (minMeasuredValue - minValue) * angleStep
      );
      mainCtx.translate(-centerX, -centerY);
      mainCtx.drawImage(
        minMeasuredValueBuffer,
        mainCtx.canvas.width * 0.4865,
        mainCtx.canvas.height * 0.105
      );
      mainCtx.restore();
    }

    // Draw max measured value indicator
    if (maxMeasuredValueVisible) {
      mainCtx.save();
      mainCtx.translate(centerX, centerY);
      mainCtx.rotate(
        rotationOffset + HALF_PI + (maxMeasuredValue - minValue) * angleStep
      );
      mainCtx.translate(-centerX, -centerY);
      mainCtx.drawImage(
        maxMeasuredValueBuffer,
        mainCtx.canvas.width * 0.4865,
        mainCtx.canvas.height * 0.105
      );
      mainCtx.restore();
    }

    angle = rotationOffset + HALF_PI + (value - minValue) * angleStep;

    // Define rotation center
    mainCtx.save();
    mainCtx.translate(centerX, centerY);
    mainCtx.rotate(angle);
    mainCtx.translate(-centerX, -centerY);
    // Set the pointer shadow params
    mainCtx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    mainCtx.shadowOffsetX = mainCtx.shadowOffsetY = shadowOffset;
    mainCtx.shadowBlur = shadowOffset * 2;
    // Draw the pointer
    mainCtx.drawImage(pointerBuffer, 0, 0);
    // Undo the translations & shadow settings
    mainCtx.restore();

    // Draw foreground
    if (foregroundVisible) {
      mainCtx.drawImage(foregroundBuffer, 0, 0);
    }
  };

  // Visualize the component
  repaint();
}

class RadialElement extends BaseElement {
  static get drawFunction () { return drawRadial }

  static get properties () {
    return {
      size: { type: Number, defaultValue: 200 },
      value: { type: Number, defaultValue: 0 },
      real_value: { state: true },
      transitionTime: { type: Number, defaultValue: 500 },
      minValue: { type: Number, defaultValue: 0 },
      maxValue: { type: Number, defaultValue: 100 },
      threshold: { type: Number, defaultValue: 50 },
      gaugeType: { type: String, objectEnum: GaugeType, defaultValue: 'TYPE1' },
      noNiceScale: { type: Boolean, defaultValue: false },
      titleString: { type: String, defaultValue: '' },
      unitString: { type: String, defaultValue: '' },
      frameDesign: { type: String, objectEnum: FrameDesign, defaultValue: 'METAL' },
      noFrameVisible: { type: Boolean, defaultValue: false },
      backgroundColor: { type: String, objectEnum: BackgroundColor, defaultValue: 'DARK_GRAY' },
      noBackgroundVisible: { type: Boolean, defaultValue: false },
      pointerType: { type: String, objectEnum: PointerType, defaultValue: 'TYPE1' },
      pointerColor: { type: String, objectEnum: Color$1, defaultValue: 'RED' },
      knobType: { type: String, objectEnum: KnobType, defaultValue: 'METAL_KNOB' },
      knobStyle: { type: String, objectEnum: KnobStyle, defaultValue: 'BLACK' },
      lcdColor: { type: String, objectEnum: LcdColor, defaultValue: 'STANDARD' },
      noLcdVisible: { type: Boolean, defaultValue: false },
      lcdDecimals: { type: Number, defaultValue: 2 },
      digitalFont: { type: Boolean, defaultValue: false },
      fractionalScaleDecimals: { type: Number, defaultValue: 1 },
      thresholdVisible: { type: Boolean, defaultValue: false },
      minMeasuredValueVisible: { type: Boolean, defaultValue: false },
      maxMeasuredValueVisible: { type: Boolean, defaultValue: false },
      labelNumberFormat: { type: String, objectEnum: LabelNumberFormat, defaultValue: 'STANDARD' },
      foregroundType: { type: String, objectEnum: ForegroundType, defaultValue: 'TYPE1' },
      noForegroundVisible: { type: Boolean, defaultValue: false },
      tickLabelOrientation: { type: String, objectEnum: TickLabelOrientation, defaultValue: 'TANGENT' },
      trendVisible: { type: Boolean, defaultValue: false },
      useOdometer: { type: Boolean, defaultValue: false }
    }
  }

  constructor () {
    super();
    this._timer = timer(() => {});
    this._timer.stop();
  }

  connectedCallback () {
    super.connectedCallback();
    this.real_value = this.real_value ?? this.minValue;
  }

  render () {
    return $`
      <canvas width="${this.size}" height="${this.size}"></canvas>
    `
  }

  updated (changedProperties) {
    super.updated();
    if (changedProperties.has('value') || changedProperties.has('transitionTime')) {
      const transitionTime = this.transitionTime;
      const originTime = now();
      const originValue = this.real_value;
      const targetValue = this.value;
      const timeScale = transitionTime <= 0 ? () => 1 : linear().domain([0, transitionTime]).clamp(true);
      const valueScale = linear().range([originValue, targetValue]).clamp(true);
      this._timer.restart((elapsedTime) => {
        const scaled = timeScale(elapsedTime);
        const eased = cubicInOut(scaled);
        const newValue = valueScale(eased);
        this.real_value = newValue;
        if (now() >= originTime + transitionTime) {
          this._timer.stop();
        }
      });
    }
  }
}

window.customElements.define('steelseries-radial', RadialElement);

function drawRadialBargraph (canvas, parameters) {
  parameters = parameters || {};
  const gaugeType =
    undefined === parameters.gaugeType ? GaugeType.TYPE4 : parameters.gaugeType;
  let size = undefined === parameters.size ? 0 : parameters.size;
  let minValue = undefined === parameters.minValue ? 0 : parameters.minValue;
  let maxValue =
    undefined === parameters.maxValue ? minValue + 100 : parameters.maxValue;
  const niceScale =
    undefined === parameters.niceScale ? true : parameters.niceScale;
  undefined === parameters.threshold
      ? (maxValue - minValue) / 2 + minValue
      : parameters.threshold;
  const section = undefined === parameters.section ? null : parameters.section;
  const useSectionColors =
    undefined === parameters.useSectionColors
      ? false
      : parameters.useSectionColors;
  const titleString =
    undefined === parameters.titleString ? '' : parameters.titleString;
  const unitString =
    undefined === parameters.unitString ? '' : parameters.unitString;
  const frameDesign =
    undefined === parameters.frameDesign
      ? FrameDesign.METAL
      : parameters.frameDesign;
  const frameVisible =
    undefined === parameters.frameVisible ? true : parameters.frameVisible;
  const backgroundColor =
    undefined === parameters.backgroundColor
      ? BackgroundColor.DARK_GRAY
      : parameters.backgroundColor;
  const backgroundVisible =
    undefined === parameters.backgroundVisible
      ? true
      : parameters.backgroundVisible;
  const valueColor =
    undefined === parameters.valueColor ? Color$1.RED : parameters.valueColor;
  const lcdColor =
    undefined === parameters.lcdColor ? LcdColor.STANDARD : parameters.lcdColor;
  const lcdVisible =
    undefined === parameters.lcdVisible ? true : parameters.lcdVisible;
  const lcdDecimals =
    undefined === parameters.lcdDecimals ? 2 : parameters.lcdDecimals;
  const digitalFont =
    undefined === parameters.digitalFont ? false : parameters.digitalFont;
  const fractionalScaleDecimals =
    undefined === parameters.fractionalScaleDecimals
      ? 1
      : parameters.fractionalScaleDecimals;
  const customLayer =
    undefined === parameters.customLayer ? null : parameters.customLayer;
  const ledColor =
    undefined === parameters.ledColor ? LedColor.RED_LED : parameters.ledColor;
  const ledVisible =
    undefined === parameters.ledVisible ? false : parameters.ledVisible;
  const userLedColor =
    undefined === parameters.userLedColor
      ? LedColor.GREEN_LED
      : parameters.userLedColor;
  const userLedVisible =
    undefined === parameters.userLedVisible ? false : parameters.userLedVisible;
  const labelNumberFormat =
    undefined === parameters.labelNumberFormat
      ? LabelNumberFormat.STANDARD
      : parameters.labelNumberFormat;
  const foregroundType =
    undefined === parameters.foregroundType
      ? ForegroundType.TYPE1
      : parameters.foregroundType;
  const foregroundVisible =
    undefined === parameters.foregroundVisible
      ? true
      : parameters.foregroundVisible;
  const playAlarm =
    undefined === parameters.playAlarm ? false : parameters.playAlarm;
  const alarmSound =
    undefined === parameters.alarmSound ? false : parameters.alarmSound;
  const valueGradient =
    undefined === parameters.valueGradient ? null : parameters.valueGradient;
  const useValueGradient =
    undefined === parameters.useValueGradient
      ? false
      : parameters.useValueGradient;
  const tickLabelOrientation =
    undefined === parameters.tickLabelOrientation
      ? gaugeType === GaugeType.TYPE1
        ? TickLabelOrientation.TANGENT
        : TickLabelOrientation.NORMAL
      : parameters.tickLabelOrientation;
  const trendVisible =
    undefined === parameters.trendVisible ? false : parameters.trendVisible;
  const trendColors =
    undefined === parameters.trendColors
      ? [LedColor.RED_LED, LedColor.GREEN_LED, LedColor.CYAN_LED]
      : parameters.trendColors;

  // Get the canvas context and clear it
  const mainCtx = getCanvasContext(canvas);
  // Has a size been specified?
  if (size === 0) {
    size = Math.min(mainCtx.canvas.width, mainCtx.canvas.height);
  }

  // Set the size - also clears the canvas
  mainCtx.canvas.width = size;
  mainCtx.canvas.height = size;

  let audioElement;

  // Create audio tag for alarm sound
  if (playAlarm && alarmSound !== false) {
    audioElement = doc.createElement('audio');
    audioElement.setAttribute('src', alarmSound);
    audioElement.setAttribute('preload', 'auto');
  }

  let value = parameters.value ?? minValue;
  let range = maxValue - minValue;

  // GaugeType specific private variables
  let freeAreaAngle;
  let rotationOffset;
  let bargraphOffset;
  let angleRange;
  let degAngleRange;
  let angleStep;

  let sectionAngles = [];
  let isSectionsVisible = false;
  let isGradientVisible = false;

  const imageWidth = size;
  const imageHeight = size;

  const centerX = imageWidth / 2;
  const centerY = imageHeight / 2;

  // Misc
  const lcdFontHeight = Math.floor(imageWidth / 10);
  const stdFont = lcdFontHeight + 'px ' + stdFontName;
  const lcdFont = lcdFontHeight + 'px ' + lcdFontName;
  const lcdHeight = imageHeight * 0.13;
  const lcdWidth = imageWidth * 0.4;
  const lcdPosX = (imageWidth - lcdWidth) / 2;
  const lcdPosY = imageHeight / 2 - lcdHeight / 2;

  // Constants
  const ACTIVE_LED_POS_X = imageWidth * 0.116822;
  const ACTIVE_LED_POS_Y = imageWidth * 0.485981;
  const LED_SIZE = Math.ceil(size * 0.093457);
  // let LED_POS_X = imageWidth * 0.453271;
  const LED_POS_X = imageWidth * 0.53;
  const LED_POS_Y = imageHeight * 0.61;
  const USER_LED_POS_X =
    gaugeType === GaugeType.TYPE3 ? 0.7 * imageWidth : centerX - LED_SIZE / 2;
  const USER_LED_POS_Y =
    gaugeType === GaugeType.TYPE3 ? 0.61 * imageHeight : 0.75 * imageHeight;

  const trendIndicator = TrendState.OFF;
  const trendSize = size * 0.06;
  const trendPosX = size * 0.38;
  const trendPosY = size * 0.57;

  switch (gaugeType.type) {
    case 'type1':
      freeAreaAngle = 0;
      rotationOffset = PI;
      bargraphOffset = 0;
      angleRange = HALF_PI;
      degAngleRange = angleRange * DEG_FACTOR;
      angleStep = angleRange / range;
      break

    case 'type2':
      freeAreaAngle = 0;
      rotationOffset = PI;
      bargraphOffset = 0;
      angleRange = PI;
      degAngleRange = angleRange * DEG_FACTOR;
      angleStep = angleRange / range;
      break

    case 'type3':
      freeAreaAngle = 0;
      rotationOffset = HALF_PI;
      bargraphOffset = -HALF_PI;
      angleRange = 1.5 * PI;
      degAngleRange = angleRange * DEG_FACTOR;
      angleStep = angleRange / range;
      break

    case 'type4':
    /* falls through */
    default:
      freeAreaAngle = 60 * RAD_FACTOR;
      rotationOffset = HALF_PI + freeAreaAngle / 2;
      bargraphOffset = -TWO_PI / 6;
      angleRange = TWO_PI - freeAreaAngle;
      degAngleRange = angleRange * DEG_FACTOR;
      angleStep = angleRange / range;
      break
  }

  // Buffer for the frame
  const frameBuffer = createBuffer(size, size);
  const frameContext = frameBuffer.getContext('2d');

  // Buffer for static background painting code
  const backgroundBuffer = createBuffer(size, size);
  const backgroundContext = backgroundBuffer.getContext('2d');

  let lcdBuffer;

  // Buffer for active bargraph led
  const activeLedBuffer = createBuffer(
    Math.ceil(size * 0.060747),
    Math.ceil(size * 0.023364)
  );
  const activeLedContext = activeLedBuffer.getContext('2d');

  // Buffer for led on painting code
  const ledBufferOn = createBuffer(LED_SIZE, LED_SIZE);
  const ledContextOn = ledBufferOn.getContext('2d');

  // Buffer for led off painting code
  const ledBufferOff = createBuffer(LED_SIZE, LED_SIZE);
  const ledContextOff = ledBufferOff.getContext('2d');

  // Buffer for current led painting code
  const ledBuffer = ledBufferOff;

  // Buffer for user led on painting code
  const userLedBufferOn = createBuffer(LED_SIZE, LED_SIZE);
  const userLedContextOn = userLedBufferOn.getContext('2d');

  // Buffer for user led off painting code
  const userLedBufferOff = createBuffer(LED_SIZE, LED_SIZE);
  const userLedContextOff = userLedBufferOff.getContext('2d');

  // Buffer for current user led painting code
  const userLedBuffer = userLedBufferOff;

  // Buffer for static foreground painting code
  const foregroundBuffer = createBuffer(size, size);
  const foregroundContext = foregroundBuffer.getContext('2d');

  // Buffers for trend indicators
  let trendUpBuffer;
  let trendSteadyBuffer;
  let trendDownBuffer;
  let trendOffBuffer;

  let initialized = false;

  // Tickmark specific private variables
  let niceMinValue = minValue;
  let niceMaxValue = maxValue;
  let niceRange = maxValue - minValue;
  range = niceMaxValue - niceMinValue;
  let minorTickSpacing = 0;
  let majorTickSpacing = 0;
  const maxNoOfMinorTicks = 10;
  const maxNoOfMajorTicks = 10;

  // Method to calculate nice values for min, max and range for the tickmarks
  const calculate = function calculate () {
    if (niceScale) {
      niceRange = calcNiceNumber(maxValue - minValue, false);
      majorTickSpacing = calcNiceNumber(
        niceRange / (maxNoOfMajorTicks - 1),
        true
      );
      niceMinValue = Math.floor(minValue / majorTickSpacing) * majorTickSpacing;
      niceMaxValue = Math.ceil(maxValue / majorTickSpacing) * majorTickSpacing;
      minorTickSpacing = calcNiceNumber(
        majorTickSpacing / (maxNoOfMinorTicks - 1),
        true
      );
      minValue = niceMinValue;
      maxValue = niceMaxValue;
      range = maxValue - minValue;
    } else {
      niceRange = maxValue - minValue;
      niceMinValue = minValue;
      niceMaxValue = maxValue;
      range = niceRange;
      // minorTickSpacing = 1;
      // majorTickSpacing = 10;
      majorTickSpacing = calcNiceNumber(
        niceRange / (maxNoOfMajorTicks - 1),
        true
      );
      minorTickSpacing = calcNiceNumber(
        majorTickSpacing / (maxNoOfMinorTicks - 1),
        true
      );
    }
    // Make sure values are still in range
    value = value < minValue ? minValue : value > maxValue ? maxValue : value;

    switch (gaugeType.type) {
      case 'type1':
        freeAreaAngle = 0;
        rotationOffset = PI;
        angleRange = HALF_PI;
        angleStep = angleRange / range;
        break

      case 'type2':
        freeAreaAngle = 0;
        rotationOffset = PI;
        angleRange = PI;
        angleStep = angleRange / range;
        break

      case 'type3':
        freeAreaAngle = 0;
        rotationOffset = HALF_PI;
        angleRange = 1.5 * PI;
        angleStep = angleRange / range;
        break

      case 'type4': // fall through
      /* falls through */
      default:
        freeAreaAngle = 60 * RAD_FACTOR;
        rotationOffset = HALF_PI + freeAreaAngle / 2;
        angleRange = TWO_PI - freeAreaAngle;
        angleStep = angleRange / range;
        break
    }
  };

  //* ******************************** Private methods *********************************
  // Draw all static painting code to background
  const init = function (parameters) {
    parameters = parameters || {};
    const drawFrame2 =
      undefined === parameters.frame ? false : parameters.frame;
    const drawBackground2 =
      undefined === parameters.background ? false : parameters.background;
    const drawLed = undefined === parameters.led ? false : parameters.led;
    const drawUserLed =
      undefined === parameters.userLed ? false : parameters.userLed;
    const drawValue = undefined === parameters.value ? false : parameters.value;
    const drawForeground2 =
      undefined === parameters.foreground ? false : parameters.foreground;
    const drawTrend = undefined === parameters.trend ? false : parameters.trend;

    initialized = true;

    calculate();

    // Create frame in frame buffer (frameBuffer)
    if (drawFrame2 && frameVisible) {
      drawFrame(
        frameContext,
        frameDesign,
        centerX,
        centerY,
        imageWidth,
        imageHeight
      );
    }

    // Create background in background buffer (backgroundBuffer)
    if (drawBackground2 && backgroundVisible) {
      drawBackground(
        backgroundContext,
        backgroundColor,
        centerX,
        centerY,
        imageWidth,
        imageHeight
      );

      // Create custom layer in background buffer (backgroundBuffer)
      drawRadialCustomImage(
        backgroundContext,
        customLayer,
        centerX,
        centerY,
        imageWidth,
        imageHeight
      );
    }

    if (drawLed) {
      // Draw LED ON in ledBuffer_ON
      ledContextOn.drawImage(createLedImage(LED_SIZE, 1, ledColor), 0, 0);

      // Draw LED OFF in ledBuffer_OFF
      ledContextOff.drawImage(createLedImage(LED_SIZE, 0, ledColor), 0, 0);
    }

    if (drawUserLed) {
      // Draw user LED ON in userLedBuffer_ON
      userLedContextOn.drawImage(
        createLedImage(Math.ceil(LED_SIZE), 1, userLedColor),
        0,
        0
      );

      // Draw user LED OFF in userLedBuffer_OFF
      userLedContextOff.drawImage(
        createLedImage(Math.ceil(LED_SIZE), 0, userLedColor),
        0,
        0
      );
    }

    if (drawBackground2) {
      // Create bargraphtrack in background buffer (backgroundBuffer)
      drawBargraphTrackImage(backgroundContext);
    }

    // Create tickmarks in background buffer (backgroundBuffer)
    if (drawBackground2 && backgroundVisible) {
      drawTickmarksImage(backgroundContext, labelNumberFormat);

      // Create title in background buffer (backgroundBuffer)
      drawTitleImage(
        backgroundContext,
        imageWidth,
        imageHeight,
        titleString,
        unitString,
        backgroundColor,
        true,
        true
      );
    }

    // Create lcd background if selected in background buffer (backgroundBuffer)
    if (drawBackground2 && lcdVisible) {
      lcdBuffer = createLcdBackgroundImage(lcdWidth, lcdHeight, lcdColor);
      backgroundContext.drawImage(lcdBuffer, lcdPosX, lcdPosY);
    }

    // Convert Section values into angles
    isSectionsVisible = false;
    if (useSectionColors && section !== null && section.length > 0) {
      isSectionsVisible = true;
      let sectionIndex = section.length;
      sectionAngles = [];
      do {
        sectionIndex--;
        sectionAngles.push({
          start:
            ((section[sectionIndex].start + Math.abs(minValue)) /
              (maxValue - minValue)) *
            degAngleRange,
          stop:
            ((section[sectionIndex].stop + Math.abs(minValue)) /
              (maxValue - minValue)) *
            degAngleRange,
          color: customColorDef(section[sectionIndex].color)
        });
      } while (sectionIndex > 0)
    }

    // Use a gradient for the valueColor?
    isGradientVisible = false;
    if (useValueGradient && valueGradient !== null) {
      // force section colors off!
      isSectionsVisible = false;
      isGradientVisible = true;
    }

    // Create an image of an active led in active led buffer (activeLedBuffer)
    if (drawValue) {
      drawActiveLed(activeLedContext, valueColor);
    }

    // Create foreground in foreground buffer (foregroundBuffer)
    if (drawForeground2 && foregroundVisible) {
      drawForeground(
        foregroundContext,
        foregroundType,
        imageWidth,
        imageHeight,
        false
      );
    }

    // Create the trend indicator buffers
    if (drawTrend && trendVisible) {
      trendUpBuffer = createTrendIndicator(
        trendSize,
        TrendState.UP,
        trendColors
      );
      trendSteadyBuffer = createTrendIndicator(
        trendSize,
        TrendState.STEADY,
        trendColors
      );
      trendDownBuffer = createTrendIndicator(
        trendSize,
        TrendState.DOWN,
        trendColors
      );
      trendOffBuffer = createTrendIndicator(
        trendSize,
        TrendState.OFF,
        trendColors
      );
    }
  };

  const drawBargraphTrackImage = function (ctx) {
    ctx.save();

    // Bargraphtrack

    // Frame
    ctx.save();
    ctx.lineWidth = size * 0.085;
    ctx.beginPath();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotationOffset - 4 * RAD_FACTOR);
    ctx.translate(-centerX, -centerY);
    ctx.arc(
      centerX,
      centerY,
      imageWidth * 0.35514,
      0,
      angleRange + 8 * RAD_FACTOR,
      false
    );
    ctx.rotate(-rotationOffset);
    const ledTrackFrameGradient = ctx.createLinearGradient(
      0,
      0.107476 * imageHeight,
      0,
      0.897195 * imageHeight
    );
    ledTrackFrameGradient.addColorStop(0, '#000000');
    ledTrackFrameGradient.addColorStop(0.22, '#333333');
    ledTrackFrameGradient.addColorStop(0.76, '#333333');
    ledTrackFrameGradient.addColorStop(1, '#cccccc');
    ctx.strokeStyle = ledTrackFrameGradient;
    ctx.stroke();
    ctx.restore();

    // Main
    ctx.save();
    ctx.lineWidth = size * 0.075;
    ctx.beginPath();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotationOffset - 4 * RAD_FACTOR);
    ctx.translate(-centerX, -centerY);
    ctx.arc(
      centerX,
      centerY,
      imageWidth * 0.35514,
      0,
      angleRange + 8 * RAD_FACTOR,
      false
    );
    ctx.rotate(-rotationOffset);
    const ledTrackMainGradient = ctx.createLinearGradient(
      0,
      0.112149 * imageHeight,
      0,
      0.892523 * imageHeight
    );
    ledTrackMainGradient.addColorStop(0, '#111111');
    ledTrackMainGradient.addColorStop(1, '#333333');
    ctx.strokeStyle = ledTrackMainGradient;
    ctx.stroke();
    ctx.restore();

    // Draw inactive leds
    const ledCenterX = (imageWidth * 0.116822 + imageWidth * 0.060747) / 2;
    const ledCenterY = (imageWidth * 0.485981 + imageWidth * 0.023364) / 2;
    const ledOffGradient = ctx.createRadialGradient(
      ledCenterX,
      ledCenterY,
      0,
      ledCenterX,
      ledCenterY,
      0.030373 * imageWidth
    );
    ledOffGradient.addColorStop(0, '#3c3c3c');
    ledOffGradient.addColorStop(1, '#323232');
    let angle = 0;
    for (angle = 0; angle <= degAngleRange; angle += 5) {
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(angle * RAD_FACTOR + bargraphOffset);
      ctx.translate(-centerX, -centerY);
      ctx.beginPath();
      ctx.rect(
        imageWidth * 0.116822,
        imageWidth * 0.485981,
        imageWidth * 0.060747,
        imageWidth * 0.023364
      );
      ctx.closePath();
      ctx.fillStyle = ledOffGradient;
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  };

  const drawActiveLed = function (ctx, color) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.closePath();
    const ledCenterX = ctx.canvas.width / 2;
    const ledCenterY = ctx.canvas.height / 2;
    const ledGradient = mainCtx.createRadialGradient(
      ledCenterX,
      ledCenterY,
      0,
      ledCenterX,
      ledCenterY,
      ctx.canvas.width / 2
    );
    ledGradient.addColorStop(0, color.light.getRgbaColor());
    ledGradient.addColorStop(1, color.dark.getRgbaColor());
    ctx.fillStyle = ledGradient;
    ctx.fill();
    ctx.restore();
  };

  const drawLcdText = function (ctx, value) {
    ctx.save();
    ctx.textAlign = 'right';
    ctx.strokeStyle = lcdColor.textColor;
    ctx.fillStyle = lcdColor.textColor;

    if (
      lcdColor === LcdColor.STANDARD ||
      lcdColor === LcdColor.STANDARD_GREEN
    ) {
      ctx.shadowColor = 'gray';
      ctx.shadowOffsetX = imageWidth * 0.007;
      ctx.shadowOffsetY = imageWidth * 0.007;
      ctx.shadowBlur = imageWidth * 0.007;
    }

    if (digitalFont) {
      ctx.font = lcdFont;
    } else {
      ctx.font = stdFont;
    }
    ctx.fillText(
      value.toFixed(lcdDecimals),
      lcdPosX + lcdWidth - lcdWidth * 0.05,
      lcdPosY + lcdHeight * 0.5 + lcdFontHeight * 0.38,
      lcdWidth * 0.9
    );

    ctx.restore();
  };

  const drawTickmarksImage = function (ctx, labelNumberFormat) {
    let alpha = rotationOffset; // Tracks total rotation
    const rotationStep = angleStep * minorTickSpacing;
    let textRotationAngle;
    const fontSize = Math.ceil(imageWidth * 0.04);
    let valueCounter = minValue;
    let majorTickCounter = maxNoOfMinorTicks - 1;
    const TEXT_TRANSLATE_X = imageWidth * 0.28;
    let TEXT_WIDTH = imageWidth * 0.1;
    const MAX_VALUE_ROUNDED = parseFloat(maxValue.toFixed(2));
    let i;

    backgroundColor.labelColor.setAlpha(1);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = fontSize + 'px ' + stdFontName;
    ctx.strokeStyle = backgroundColor.labelColor.getRgbaColor();
    ctx.fillStyle = backgroundColor.labelColor.getRgbaColor();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotationOffset);

    if (gaugeType.type === 'type1' || gaugeType.type === 'type2') {
      TEXT_WIDTH = imageWidth * 0.0375;
    }

    for (
      i = minValue;
      parseFloat(i.toFixed(2)) <= MAX_VALUE_ROUNDED;
      i += minorTickSpacing
    ) {
      textRotationAngle = +rotationStep + HALF_PI;
      majorTickCounter++;
      // Draw major tickmarks
      if (majorTickCounter === maxNoOfMinorTicks) {
        ctx.save();
        ctx.translate(TEXT_TRANSLATE_X, 0);

        switch (tickLabelOrientation.type) {
          case 'horizontal':
            textRotationAngle = -alpha;
            break

          case 'tangent':
            textRotationAngle = alpha <= HALF_PI + PI ? PI : 0;
            break

          case 'normal':
          /* falls through */
          default:
            textRotationAngle = HALF_PI;
            break
        }
        ctx.rotate(textRotationAngle);

        switch (labelNumberFormat.format) {
          case 'fractional':
            ctx.fillText(
              valueCounter.toFixed(fractionalScaleDecimals),
              0,
              0,
              TEXT_WIDTH
            );
            break

          case 'scientific':
            ctx.fillText(valueCounter.toPrecision(2), 0, 0, TEXT_WIDTH);
            break

          case 'standard':
          /* falls through */
          default:
            ctx.fillText(valueCounter.toFixed(0), 0, 0, TEXT_WIDTH);
            break
        }
        ctx.translate(-TEXT_TRANSLATE_X, 0);
        ctx.restore();

        valueCounter += majorTickSpacing;
        majorTickCounter = 0;
        ctx.rotate(rotationStep);
        alpha += rotationStep;
        continue
      }
      ctx.rotate(rotationStep);
      alpha += rotationStep;
    }

    ctx.translate(-centerX, -centerY);
    ctx.restore();
  };

  const repaint = function () {
    const activeLedAngle =
      ((value - minValue) / (maxValue - minValue)) * degAngleRange;
    let activeLedColor;
    let lastActiveLedColor = valueColor;
    let angle;
    let i;
    let currentValue;
    let gradRange;
    let fraction;

    if (!initialized) {
      init({
        frame: true,
        background: true,
        led: true,
        userLed: true,
        value: true,
        trend: true,
        foreground: true
      });
    }

    mainCtx.clearRect(0, 0, size, size);

    // Draw frame image
    if (frameVisible) {
      mainCtx.drawImage(frameBuffer, 0, 0);
    }

    // Draw buffered image to visible canvas
    mainCtx.drawImage(backgroundBuffer, 0, 0);

    // Draw active leds
    for (angle = 0; angle <= activeLedAngle; angle += 5) {
      // check for LED color
      activeLedColor = valueColor;
      // Use a gradient for value colors?
      if (isGradientVisible) {
        // Convert angle back to value
        currentValue =
          minValue + (angle / degAngleRange) * (maxValue - minValue);
        gradRange = valueGradient.getEnd() - valueGradient.getStart();
        fraction = (currentValue - minValue) / gradRange;
        fraction = Math.max(Math.min(fraction, 1), 0);
        activeLedColor = customColorDef(
          valueGradient.getColorAt(fraction).getRgbaColor()
        );
      } else if (isSectionsVisible) {
        for (i = 0; i < sectionAngles.length; i++) {
          if (
            angle >= sectionAngles[i].start &&
            angle < sectionAngles[i].stop
          ) {
            activeLedColor = sectionAngles[i].color;
            break
          }
        }
      }
      // Has LED color changed? If so redraw the buffer
      if (
        lastActiveLedColor.medium.getHexColor() !==
        activeLedColor.medium.getHexColor()
      ) {
        drawActiveLed(activeLedContext, activeLedColor);
        lastActiveLedColor = activeLedColor;
      }
      mainCtx.save();
      mainCtx.translate(centerX, centerY);
      mainCtx.rotate(angle * RAD_FACTOR + bargraphOffset);
      mainCtx.translate(-centerX, -centerY);
      mainCtx.drawImage(activeLedBuffer, ACTIVE_LED_POS_X, ACTIVE_LED_POS_Y);
      mainCtx.restore();
    }

    // Draw lcd display
    if (lcdVisible) {
      drawLcdText(mainCtx, value);
    }

    // Draw led
    if (ledVisible) {
      mainCtx.drawImage(ledBuffer, LED_POS_X, LED_POS_Y);
    }

    // Draw user led
    if (userLedVisible) {
      mainCtx.drawImage(userLedBuffer, USER_LED_POS_X, USER_LED_POS_Y);
    }

    // Draw the trend indicator
    if (trendVisible) {
      switch (trendIndicator.state) {
        case 'up':
          mainCtx.drawImage(trendUpBuffer, trendPosX, trendPosY);
          break
        case 'steady':
          mainCtx.drawImage(trendSteadyBuffer, trendPosX, trendPosY);
          break
        case 'down':
          mainCtx.drawImage(trendDownBuffer, trendPosX, trendPosY);
          break
        case 'off':
          mainCtx.drawImage(trendOffBuffer, trendPosX, trendPosY);
          break
      }
    }

    // Draw foreground
    if (foregroundVisible) {
      mainCtx.drawImage(foregroundBuffer, 0, 0);
    }
  };

  // Visualize the component
  repaint();
}

class RadialBargraphElement extends BaseElement {
  static get drawFunction () { return drawRadialBargraph }

  static get properties () {
    return {
      size: { type: Number, defaultValue: 200 },
      value: { type: Number, defaultValue: 0 },
      real_value: { state: true },
      transitionTime: { type: Number, defaultValue: 500 },
      minValue: { type: Number, defaultValue: 0 },
      maxValue: { type: Number, defaultValue: 100 },
      threshold: { type: Number, defaultValue: 50 },
      gaugeType: { type: String, objectEnum: GaugeType, defaultValue: 'TYPE1' },
      noNiceScale: { type: Boolean, defaultValue: false },
      titleString: { type: String, defaultValue: '' },
      unitString: { type: String, defaultValue: '' },
      frameDesign: { type: String, objectEnum: FrameDesign, defaultValue: 'METAL' },
      noFrameVisible: { type: Boolean, defaultValue: false },
      backgroundColor: { type: String, objectEnum: BackgroundColor, defaultValue: 'DARK_GRAY' },
      noBackgroundVisible: { type: Boolean, defaultValue: false },
      valueColor: { type: String, objectEnum: Color$1, defaultValue: 'RED' },
      lcdColor: { type: String, objectEnum: LcdColor, defaultValue: 'STANDARD' },
      noLcdVisible: { type: Boolean, defaultValue: false },
      lcdDecimals: { type: Number, defaultValue: 2 },
      digitalFont: { type: Boolean, defaultValue: false },
      fractionalScaleDecimals: { type: Number, defaultValue: 1 },
      labelNumberFormat: { type: String, objectEnum: LabelNumberFormat, defaultValue: 'STANDARD' },
      foregroundType: { type: String, objectEnum: ForegroundType, defaultValue: 'TYPE1' },
      noForegroundVisible: { type: Boolean, defaultValue: false },
      tickLabelOrientation: { type: String, objectEnum: TickLabelOrientation, defaultValue: 'TANGENT' },
      trendVisible: { type: Boolean, defaultValue: false }
    }
  }

  constructor () {
    super();
    this._timer = timer(() => {});
    this._timer.stop();
  }

  connectedCallback () {
    super.connectedCallback();
    this.real_value = this.real_value ?? this.minValue;
  }

  render () {
    return $`
      <canvas width="${this.size}" height="${this.size}"></canvas>
    `
  }

  updated (changedProperties) {
    super.updated();
    if (changedProperties.has('value') || changedProperties.has('transitionTime')) {
      const transitionTime = this.transitionTime;
      const originTime = now();
      const originValue = this.real_value;
      const targetValue = this.value;
      const timeScale = transitionTime <= 0 ? () => 1 : linear().domain([0, transitionTime]).clamp(true);
      const valueScale = linear().range([originValue, targetValue]).clamp(true);
      this._timer.restart((elapsedTime) => {
        const scaled = timeScale(elapsedTime);
        const eased = cubicInOut(scaled);
        const newValue = valueScale(eased);
        this.real_value = newValue;
        if (now() >= originTime + transitionTime) {
          this._timer.stop();
        }
      });
    }
  }
}

window.customElements.define('steelseries-radial-bargraph', RadialBargraphElement);

function drawRadialVertical (canvas, parameters) {
  parameters = parameters || {};
  const orientation =
    undefined === parameters.orientation
      ? Orientation.NORTH
      : parameters.orientation;
  let size = undefined === parameters.size ? 0 : parameters.size;
  let minValue = undefined === parameters.minValue ? 0 : parameters.minValue;
  let maxValue =
    undefined === parameters.maxValue ? minValue + 100 : parameters.maxValue;
  const niceScale =
    undefined === parameters.niceScale ? true : parameters.niceScale;
  let threshold =
    undefined === parameters.threshold
      ? (maxValue - minValue) / 2 + minValue
      : parameters.threshold;
  const section = undefined === parameters.section ? null : parameters.section;
  const area = undefined === parameters.area ? null : parameters.area;
  const titleString =
    undefined === parameters.titleString ? '' : parameters.titleString;
  const unitString =
    undefined === parameters.unitString ? '' : parameters.unitString;
  const frameDesign =
    undefined === parameters.frameDesign
      ? FrameDesign.METAL
      : parameters.frameDesign;
  const frameVisible =
    undefined === parameters.frameVisible ? true : parameters.frameVisible;
  const backgroundColor =
    undefined === parameters.backgroundColor
      ? BackgroundColor.DARK_GRAY
      : parameters.backgroundColor;
  const backgroundVisible =
    undefined === parameters.backgroundVisible
      ? true
      : parameters.backgroundVisible;
  const pointerType =
    undefined === parameters.pointerType
      ? PointerType.TYPE1
      : parameters.pointerType;
  const pointerColor =
    undefined === parameters.pointerColor
      ? Color$1.RED
      : parameters.pointerColor;
  const knobType =
    undefined === parameters.knobType
      ? KnobType.STANDARD_KNOB
      : parameters.knobType;
  const knobStyle =
    undefined === parameters.knobStyle
      ? KnobStyle.SILVER
      : parameters.knobStyle;
  const ledColor =
    undefined === parameters.ledColor ? LedColor.RED_LED : parameters.ledColor;
  const ledVisible =
    undefined === parameters.ledVisible ? false : parameters.ledVisible;
  const thresholdVisible =
    undefined === parameters.thresholdVisible
      ? true
      : parameters.thresholdVisible;
  const minMeasuredValueVisible =
    undefined === parameters.minMeasuredValueVisible
      ? false
      : parameters.minMeasuredValueVisible;
  const maxMeasuredValueVisible =
    undefined === parameters.maxMeasuredValueVisible
      ? false
      : parameters.maxMeasuredValueVisible;
  const foregroundType =
    undefined === parameters.foregroundType
      ? ForegroundType.TYPE1
      : parameters.foregroundType;
  const foregroundVisible =
    undefined === parameters.foregroundVisible
      ? true
      : parameters.foregroundVisible;
  const labelNumberFormat =
    undefined === parameters.labelNumberFormat
      ? LabelNumberFormat.STANDARD
      : parameters.labelNumberFormat;
  const playAlarm =
    undefined === parameters.playAlarm ? false : parameters.playAlarm;
  const alarmSound =
    undefined === parameters.alarmSound ? false : parameters.alarmSound;

  // Get the canvas context and clear it
  const mainCtx = getCanvasContext(canvas);
  // Has a size been specified?
  if (size === 0) {
    size = Math.min(mainCtx.canvas.width, mainCtx.canvas.height);
  }

  // Set the size - also clears the canvas
  mainCtx.canvas.width = size;
  mainCtx.canvas.height = size;

  let audioElement;

  // Create audio tag for alarm sound
  if (playAlarm && alarmSound !== false) {
    audioElement = doc.createElement('audio');
    audioElement.setAttribute('src', alarmSound);
    audioElement.setAttribute('preload', 'auto');
  }
  const gaugeType = GaugeType.TYPE5;

  let value = parameters.value ?? minValue;

  // Properties
  let minMeasuredValue = maxValue;
  let maxMeasuredValue = minValue;
  const imageWidth = size;
  const imageHeight = size;

  // Tickmark specific private variables
  let niceMinValue = minValue;
  let niceMaxValue = maxValue;
  let niceRange = maxValue - minValue;
  let range = niceMaxValue - niceMinValue;
  let minorTickSpacing = 0;
  let majorTickSpacing = 0;
  const maxNoOfMinorTicks = 10;
  const maxNoOfMajorTicks = 10;

  let rotationOffset = 1.25 * PI;
  let angleRange = HALF_PI;
  let angleStep = angleRange / range;
  const shadowOffset = imageWidth * 0.006;
  const pointerOffset = (imageWidth * 1.17) / 2;

  let initialized = false;

  let angle = rotationOffset + (value - minValue) * angleStep;

  const centerX = imageWidth / 2;
  const centerY = imageHeight * 0.733644;

  // Misc
  const ledPosX = 0.455 * imageWidth;
  const ledPosY = 0.51 * imageHeight;

  // Method to calculate nice values for min, max and range for the tickmarks
  const calculate = function calculate () {
    if (niceScale) {
      niceRange = calcNiceNumber(maxValue - minValue, false);
      majorTickSpacing = calcNiceNumber(
        niceRange / (maxNoOfMajorTicks - 1),
        true
      );
      niceMinValue = Math.floor(minValue / majorTickSpacing) * majorTickSpacing;
      niceMaxValue = Math.ceil(maxValue / majorTickSpacing) * majorTickSpacing;
      minorTickSpacing = calcNiceNumber(
        majorTickSpacing / (maxNoOfMinorTicks - 1),
        true
      );
      minValue = niceMinValue;
      maxValue = niceMaxValue;
      range = maxValue - minValue;
    } else {
      niceRange = maxValue - minValue;
      niceMinValue = minValue;
      niceMaxValue = maxValue;
      range = niceRange;
      minorTickSpacing = 1;
      majorTickSpacing = 10;
    }
    // Make sure values are still in range
    value = value < minValue ? minValue : value > maxValue ? maxValue : value;
    minMeasuredValue =
      minMeasuredValue < minValue
        ? minValue
        : minMeasuredValue > maxValue
          ? maxValue
          : minMeasuredValue;
    maxMeasuredValue =
      maxMeasuredValue < minValue
        ? minValue
        : maxMeasuredValue > maxValue
          ? maxValue
          : maxMeasuredValue;
    threshold =
      threshold < minValue
        ? minValue
        : threshold > maxValue
          ? maxValue
          : threshold;

    rotationOffset = 1.25 * PI;
    angleRange = HALF_PI;
    angleStep = angleRange / range;

    angle = rotationOffset + (value - minValue) * angleStep;
  };

  // **************   Buffer creation  ********************
  // Buffer for the frame
  const frameBuffer = createBuffer(size, size);
  const frameContext = frameBuffer.getContext('2d');

  // Buffer for the background
  const backgroundBuffer = createBuffer(size, size);
  const backgroundContext = backgroundBuffer.getContext('2d');

  // Buffer for led on painting code
  const ledBufferOn = createBuffer(size * 0.093457, size * 0.093457);
  const ledContextOn = ledBufferOn.getContext('2d');

  // Buffer for led off painting code
  const ledBufferOff = createBuffer(size * 0.093457, size * 0.093457);
  const ledContextOff = ledBufferOff.getContext('2d');

  // Buffer for current led painting code
  const ledBuffer = ledBufferOff;

  // Buffer for the minMeasuredValue indicator
  const minMeasuredValueBuffer = createBuffer(
    Math.ceil(size * 0.028037),
    Math.ceil(size * 0.028037)
  );
  const minMeasuredValueCtx = minMeasuredValueBuffer.getContext('2d');

  // Buffer for the maxMeasuredValue indicator
  const maxMeasuredValueBuffer = createBuffer(
    Math.ceil(size * 0.028037),
    Math.ceil(size * 0.028037)
  );
  const maxMeasuredValueCtx = maxMeasuredValueBuffer.getContext('2d');

  // Buffer for pointer image painting code
  const pointerBuffer = createBuffer(size, size);
  const pointerContext = pointerBuffer.getContext('2d');

  // Buffer for static foreground painting code
  const foregroundBuffer = createBuffer(size, size);
  const foregroundContext = foregroundBuffer.getContext('2d');

  // **************   Image creation  ********************
  const drawPostsImage = function (ctx) {
    if (gaugeType.type === 'type5') {
      ctx.save();
      if (orientation.type === 'west') {
        // Min post
        ctx.drawImage(
          createKnobImage(
            Math.ceil(imageHeight * 0.037383),
            KnobType.STANDARD_KNOB,
            knobStyle
          ),
          imageWidth * 0.44,
          imageHeight * 0.8
        );
        // Max post
        ctx.drawImage(
          createKnobImage(
            Math.ceil(imageHeight * 0.037383),
            KnobType.STANDARD_KNOB,
            knobStyle
          ),
          imageWidth * 0.44,
          imageHeight * 0.16
        );
      } else if (orientation.type === 'east') {
        // Min post
        ctx.drawImage(
          createKnobImage(
            Math.ceil(imageHeight * 0.037383),
            KnobType.STANDARD_KNOB,
            knobStyle
          ),
          imageWidth * 0.52,
          imageHeight * 0.8
        );
        // Max post
        ctx.drawImage(
          createKnobImage(
            Math.ceil(imageHeight * 0.037383),
            KnobType.STANDARD_KNOB,
            knobStyle
          ),
          imageWidth * 0.52,
          imageHeight * 0.16
        );
      } else {
        // Min post
        ctx.drawImage(
          createKnobImage(
            Math.ceil(imageHeight * 0.037383),
            KnobType.STANDARD_KNOB,
            knobStyle
          ),
          imageWidth * 0.2 - imageHeight * 0.037383,
          imageHeight * 0.446666
        );
        // Max post
        ctx.drawImage(
          createKnobImage(
            Math.ceil(imageHeight * 0.037383),
            KnobType.STANDARD_KNOB,
            knobStyle
          ),
          imageWidth * 0.8,
          imageHeight * 0.446666
        );
      }
      ctx.restore();
    }
  };

  const createThresholdImage = function () {
    const thresholdBuffer = doc.createElement('canvas');
    thresholdBuffer.width = Math.ceil(size * 0.046728);
    thresholdBuffer.height = Math.ceil(thresholdBuffer.width * 0.9);
    const thresholdCtx = thresholdBuffer.getContext('2d');

    thresholdCtx.save();
    const gradThreshold = thresholdCtx.createLinearGradient(
      0,
      0.1,
      0,
      thresholdBuffer.height * 0.9
    );
    gradThreshold.addColorStop(0, '#520000');
    gradThreshold.addColorStop(0.3, '#fc1d00');
    gradThreshold.addColorStop(0.59, '#fc1d00');
    gradThreshold.addColorStop(1, '#520000');
    thresholdCtx.fillStyle = gradThreshold;

    thresholdCtx.beginPath();
    thresholdCtx.moveTo(thresholdBuffer.width * 0.5, 0.1);
    thresholdCtx.lineTo(
      thresholdBuffer.width * 0.9,
      thresholdBuffer.height * 0.9
    );
    thresholdCtx.lineTo(
      thresholdBuffer.width * 0.1,
      thresholdBuffer.height * 0.9
    );
    thresholdCtx.lineTo(thresholdBuffer.width * 0.5, 0.1);
    thresholdCtx.closePath();

    thresholdCtx.fill();
    thresholdCtx.strokeStyle = '#FFFFFF';
    thresholdCtx.stroke();

    thresholdCtx.restore();

    return thresholdBuffer
  };

  const drawAreaSectionImage = function (ctx, start, stop, color, filled) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = imageWidth * 0.035;
    const startAngle =
      (angleRange / range) * start - (angleRange / range) * minValue;
    const stopAngle = startAngle + (stop - start) / (range / angleRange);
    ctx.translate(centerX, centerY);
    ctx.rotate(rotationOffset);
    ctx.beginPath();
    if (filled) {
      ctx.moveTo(0, 0);
      ctx.arc(
        0,
        0,
        imageWidth * 0.365 - ctx.lineWidth / 2,
        startAngle,
        stopAngle,
        false
      );
    } else {
      ctx.arc(0, 0, imageWidth * 0.365, startAngle, stopAngle, false);
    }
    if (filled) {
      ctx.moveTo(0, 0);
      ctx.fill();
    } else {
      ctx.stroke();
    }

    ctx.translate(-centerX, -centerY);
    ctx.restore();
  };

  const drawTitleImage = function (ctx) {
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = backgroundColor.labelColor.getRgbaColor();
    ctx.fillStyle = backgroundColor.labelColor.getRgbaColor();

    ctx.font = 0.046728 * imageWidth + 'px ' + stdFontName;
    const titleWidth = ctx.measureText(titleString).width;
    ctx.fillText(
      titleString,
      (imageWidth - titleWidth) / 2,
      imageHeight * 0.4,
      imageWidth * 0.3
    );
    const unitWidth = ctx.measureText(unitString).width;
    ctx.fillText(
      unitString,
      (imageWidth - unitWidth) / 2,
      imageHeight * 0.47,
      imageWidth * 0.2
    );

    ctx.restore();
  };

  const drawTickmarksImage = function (ctx, labelNumberFormat) {
    backgroundColor.labelColor.setAlpha(1);
    ctx.save();

    if (Orientation.WEST === orientation) {
      ctx.translate(centerX, centerX);
      ctx.rotate(-HALF_PI);
      ctx.translate(-centerX, -centerX);
    }
    if (Orientation.EAST === orientation) {
      ctx.translate(centerX, centerX);
      ctx.rotate(HALF_PI);
      ctx.translate(-centerX, -centerX);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fontSize = Math.ceil(imageWidth * 0.04);
    ctx.font = fontSize + 'px ' + stdFontName;
    ctx.strokeStyle = backgroundColor.labelColor.getRgbaColor();
    ctx.fillStyle = backgroundColor.labelColor.getRgbaColor();
    ctx.translate(centerX, centerY);
    ctx.rotate(rotationOffset);
    const rotationStep = angleStep * minorTickSpacing;
    let textRotationAngle;

    let valueCounter = minValue;
    let majorTickCounter = maxNoOfMinorTicks - 1;

    const OUTER_POINT = imageWidth * 0.44;
    const MAJOR_INNER_POINT = imageWidth * 0.41;
    const MED_INNER_POINT = imageWidth * 0.415;
    const MINOR_INNER_POINT = imageWidth * 0.42;
    const TEXT_TRANSLATE_X = imageWidth * 0.48;
    const TEXT_WIDTH = imageWidth * 0.04;
    const HALF_MAX_NO_OF_MINOR_TICKS = maxNoOfMinorTicks / 2;
    const MAX_VALUE_ROUNDED = parseFloat(maxValue.toFixed(2));
    let i;

    for (
      i = minValue;
      parseFloat(i.toFixed(2)) <= MAX_VALUE_ROUNDED;
      i += minorTickSpacing
    ) {
      textRotationAngle = +rotationStep + HALF_PI;
      majorTickCounter++;
      // Draw major tickmarks
      if (majorTickCounter === maxNoOfMinorTicks) {
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(OUTER_POINT, 0);
        ctx.lineTo(MAJOR_INNER_POINT, 0);
        ctx.closePath();
        ctx.stroke();
        ctx.save();
        ctx.translate(TEXT_TRANSLATE_X, 0);
        ctx.rotate(textRotationAngle);
        switch (labelNumberFormat.format) {
          case 'fractional':
            ctx.fillText(valueCounter.toFixed(2), 0, 0, TEXT_WIDTH);
            break

          case 'scientific':
            ctx.fillText(valueCounter.toPrecision(2), 0, 0, TEXT_WIDTH);
            break

          case 'standard':
          /* falls through */
          default:
            ctx.fillText(valueCounter.toFixed(0), 0, 0, TEXT_WIDTH);
            break
        }
        ctx.translate(-TEXT_TRANSLATE_X, 0);
        ctx.restore();

        valueCounter += majorTickSpacing;
        majorTickCounter = 0;
        ctx.rotate(rotationStep);
        continue
      }

      // Draw tickmark every minor tickmark spacing
      if (
        majorTickCounter === HALF_MAX_NO_OF_MINOR_TICKS
      ) {
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(OUTER_POINT, 0);
        ctx.lineTo(MED_INNER_POINT, 0);
        ctx.closePath();
        ctx.stroke();
      } else {
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(OUTER_POINT, 0);
        ctx.lineTo(MINOR_INNER_POINT, 0);
        ctx.closePath();
        ctx.stroke();
      }
      ctx.rotate(rotationStep);
    }

    ctx.translate(-centerX, -centerY);
    ctx.restore();
  };

  // **************   Initialization  ********************
  // Draw all static painting code to background
  const init = function (parameters) {
    parameters = parameters || {};
    const drawFrame2 =
      undefined === parameters.frame ? false : parameters.frame;
    const drawBackground2 =
      undefined === parameters.background ? false : parameters.background;
    const drawLed = undefined === parameters.led ? false : parameters.led;
    const drawPointer =
      undefined === parameters.pointer ? false : parameters.pointer;
    const drawForeground2 =
      undefined === parameters.foreground ? false : parameters.foreground;

    initialized = true;

    // Calculate the current min and max values and the range
    calculate();

    // Create frame in frame buffer (backgroundBuffer)
    if (drawFrame2 && frameVisible) {
      drawFrame(
        frameContext,
        frameDesign,
        centerX,
        size / 2,
        imageWidth,
        imageHeight
      );
    }

    // Create background in background buffer (backgroundBuffer)
    if (drawBackground2 && backgroundVisible) {
      drawBackground(
        backgroundContext,
        backgroundColor,
        centerX,
        size / 2,
        imageWidth,
        imageHeight
      );
    }

    // Draw LED ON in ledBuffer_ON
    if (drawLed) {
      ledContextOn.drawImage(
        createLedImage(Math.ceil(size * 0.093457), 1, ledColor),
        0,
        0
      );

      // Draw LED ON in ledBuffer_OFF
      ledContextOff.drawImage(
        createLedImage(Math.ceil(size * 0.093457), 0, ledColor),
        0,
        0
      );
    }

    // Draw min measured value indicator in minMeasuredValueBuffer
    if (minMeasuredValueVisible) {
      minMeasuredValueCtx.drawImage(
        createMeasuredValueImage(
          Math.ceil(size * 0.028037),
          Color$1.BLUE.dark.getRgbaColor(),
          true,
          true
        ),
        0,
        0
      );
      minMeasuredValueCtx.restore();
    }

    // Draw max measured value indicator in maxMeasuredValueBuffer
    if (maxMeasuredValueVisible) {
      maxMeasuredValueCtx.drawImage(
        createMeasuredValueImage(
          Math.ceil(size * 0.028037),
          Color$1.RED.medium.getRgbaColor(),
          true
        ),
        0,
        0
      );
      maxMeasuredValueCtx.restore();
    }

    // Create alignment posts in background buffer (backgroundBuffer)
    if (drawBackground2 && backgroundVisible) {
      drawPostsImage(backgroundContext);

      // Create section in background buffer (backgroundBuffer)
      if (section !== null && section.length > 0) {
        backgroundContext.save();
        if (Orientation.WEST === orientation) {
          backgroundContext.translate(centerX, centerX);
          backgroundContext.rotate(-HALF_PI);
          backgroundContext.translate(-centerX, -centerX);
        } else if (Orientation.EAST === orientation) {
          backgroundContext.translate(centerX, centerX);
          backgroundContext.rotate(HALF_PI);
          backgroundContext.translate(-centerX, -centerX);
        }
        let sectionIndex = section.length;
        do {
          sectionIndex--;
          drawAreaSectionImage(
            backgroundContext,
            section[sectionIndex].start,
            section[sectionIndex].stop,
            section[sectionIndex].color,
            false
          );
        } while (sectionIndex > 0)
        backgroundContext.restore();
      }

      // Create area in background buffer (backgroundBuffer)
      if (area !== null && area.length > 0) {
        if (Orientation.WEST === orientation) {
          backgroundContext.translate(centerX, centerX);
          backgroundContext.rotate(-HALF_PI);
          backgroundContext.translate(-centerX, -centerX);
        }
        if (Orientation.EAST === orientation) {
          backgroundContext.translate(centerX, centerX);
          backgroundContext.rotate(HALF_PI);
          backgroundContext.translate(-centerX, -centerX);
        }
        let areaIndex = area.length;
        do {
          areaIndex--;
          drawAreaSectionImage(
            backgroundContext,
            area[areaIndex].start,
            area[areaIndex].stop,
            area[areaIndex].color,
            true
          );
        } while (areaIndex > 0)
        backgroundContext.restore();
      }

      // Create tickmarks in background buffer (backgroundBuffer)
      drawTickmarksImage(backgroundContext, labelNumberFormat);

      // Create title in background buffer (backgroundBuffer)
      drawTitleImage(backgroundContext);
    }

    // Draw threshold image to background context
    if (thresholdVisible) {
      backgroundContext.save();
      if (Orientation.WEST === orientation) {
        backgroundContext.translate(centerX, centerX);
        backgroundContext.rotate(-HALF_PI);
        backgroundContext.translate(-centerX, -centerX);
      }
      if (Orientation.EAST === orientation) {
        backgroundContext.translate(centerX, centerX);
        backgroundContext.rotate(HALF_PI);
        backgroundContext.translate(-centerX, -centerX);
      }
      backgroundContext.translate(centerX, centerY);
      backgroundContext.rotate(
        rotationOffset + (threshold - minValue) * angleStep + HALF_PI
      );
      backgroundContext.translate(-centerX, -centerY);
      backgroundContext.drawImage(
        createThresholdImage(),
        imageWidth * 0.475,
        imageHeight * 0.32
      );
      backgroundContext.restore();
    }

    // Create pointer image in pointer buffer (contentBuffer)
    if (drawPointer) {
      drawPointerImage(
        pointerContext,
        imageWidth * 1.17,
        pointerType,
        pointerColor,
        backgroundColor.labelColor
      );
    }

    // Create foreground in foreground buffer (foregroundBuffer)
    if (drawForeground2 && foregroundVisible) {
      const knobVisible =
        !(pointerType.type === 'type15' || pointerType.type === 'type16');
      drawForeground(
        foregroundContext,
        foregroundType,
        imageWidth,
        imageHeight,
        knobVisible,
        knobType,
        knobStyle,
        gaugeType,
        orientation
      );
    }
  };

  const repaint = function () {
    if (!initialized) {
      init({
        frame: true,
        background: true,
        led: true,
        pointer: true,
        foreground: true
      });
    }

    mainCtx.clearRect(0, 0, size, size);
    mainCtx.save();

    // Draw frame
    if (frameVisible) {
      mainCtx.drawImage(frameBuffer, 0, 0);
    }

    // Draw buffered image to visible canvas
    mainCtx.drawImage(backgroundBuffer, 0, 0);

    // Draw led
    if (ledVisible) {
      mainCtx.drawImage(ledBuffer, ledPosX, ledPosY);
    }

    if (Orientation.WEST === orientation) {
      mainCtx.translate(centerX, centerX);
      mainCtx.rotate(-HALF_PI);
      mainCtx.translate(-centerX, -centerX);
    }
    if (Orientation.EAST === orientation) {
      mainCtx.translate(centerX, centerX);
      mainCtx.rotate(HALF_PI);
      mainCtx.translate(-centerX, -centerX);
    }

    // Draw min measured value indicator
    if (minMeasuredValueVisible) {
      mainCtx.save();
      mainCtx.translate(centerX, centerY);
      mainCtx.rotate(
        rotationOffset + HALF_PI + (minMeasuredValue - minValue) * angleStep
      );
      mainCtx.translate(-centerX, -centerY);
      mainCtx.drawImage(
        minMeasuredValueBuffer,
        mainCtx.canvas.width * 0.4865,
        mainCtx.canvas.height * 0.27
      );
      mainCtx.restore();
    }

    // Draw max measured value indicator
    if (maxMeasuredValueVisible) {
      mainCtx.save();
      mainCtx.translate(centerX, centerY);
      mainCtx.rotate(
        rotationOffset + HALF_PI + (maxMeasuredValue - minValue) * angleStep
      );
      mainCtx.translate(-centerX, -centerY);
      mainCtx.drawImage(
        maxMeasuredValueBuffer,
        mainCtx.canvas.width * 0.4865,
        mainCtx.canvas.height * 0.27
      );
      mainCtx.restore();
    }

    angle = rotationOffset + HALF_PI + (value - minValue) * angleStep;

    // Define rotation center
    mainCtx.save();
    mainCtx.translate(centerX, centerY);
    mainCtx.rotate(angle);
    // Set the pointer shadow params
    mainCtx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    mainCtx.shadowOffsetX = mainCtx.shadowOffsetY = shadowOffset;
    mainCtx.shadowBlur = shadowOffset * 2;
    // Draw pointer
    mainCtx.translate(-pointerOffset, -pointerOffset);
    mainCtx.drawImage(pointerBuffer, 0, 0);
    // Undo the translations & shadow settings
    mainCtx.restore();

    // Draw foreground
    if (foregroundVisible) {
      if (Orientation.WEST === orientation) {
        mainCtx.translate(centerX, centerX);
        mainCtx.rotate(HALF_PI);
        mainCtx.translate(-centerX, -centerX);
      } else if (Orientation.EAST === orientation) {
        mainCtx.translate(centerX, centerX);
        mainCtx.rotate(-HALF_PI);
        mainCtx.translate(-centerX, -centerX);
      }
      mainCtx.drawImage(foregroundBuffer, 0, 0);
    }
    mainCtx.restore();
  };

  // Visualize the component
  repaint();
}

class RadialVerticalElement extends BaseElement {
  static get drawFunction () { return drawRadialVertical }

  static get properties () {
    return {
      size: { type: Number, defaultValue: 200 },
      orientation: { type: String, objectEnum: Orientation, defaultValue: 'NORTH' },
      value: { type: Number, defaultValue: 0 },
      real_value: { state: true },
      transitionTime: { type: Number, defaultValue: 500 },
      minValue: { type: Number, defaultValue: 0 },
      maxValue: { type: Number, defaultValue: 100 },
      threshold: { type: Number, defaultValue: 50 },
      noNiceScale: { type: Boolean, defaultValue: false },
      titleString: { type: String, defaultValue: '' },
      unitString: { type: String, defaultValue: '' },
      frameDesign: { type: String, objectEnum: FrameDesign, defaultValue: 'METAL' },
      noFrameVisible: { type: Boolean, defaultValue: false },
      backgroundColor: { type: String, objectEnum: BackgroundColor, defaultValue: 'DARK_GRAY' },
      noBackgroundVisible: { type: Boolean, defaultValue: false },
      pointerType: { type: String, objectEnum: PointerType, defaultValue: 'TYPE1' },
      pointerColor: { type: String, objectEnum: Color$1, defaultValue: 'RED' },
      knobType: { type: String, objectEnum: KnobType, defaultValue: 'METAL_KNOB' },
      knobStyle: { type: String, objectEnum: KnobStyle, defaultValue: 'BLACK' },
      thresholdVisible: { type: Boolean, defaultValue: false },
      minMeasuredValueVisible: { type: Boolean, defaultValue: false },
      maxMeasuredValueVisible: { type: Boolean, defaultValue: false },
      labelNumberFormat: { type: String, objectEnum: LabelNumberFormat, defaultValue: 'STANDARD' },
      foregroundType: { type: String, objectEnum: ForegroundType, defaultValue: 'TYPE1' },
      noForegroundVisible: { type: Boolean, defaultValue: false }
    }
  }

  constructor () {
    super();
    this._timer = timer(() => {});
    this._timer.stop();
  }

  connectedCallback () {
    super.connectedCallback();
    this.real_value = this.real_value ?? this.minValue;
  }

  render () {
    return $`
      <canvas width="${this.size}" height="${this.size}"></canvas>
    `
  }

  updated (changedProperties) {
    super.updated();
    if (changedProperties.has('value') || changedProperties.has('transitionTime')) {
      const transitionTime = this.transitionTime;
      const originTime = now();
      const originValue = this.real_value;
      const targetValue = this.value;
      const timeScale = transitionTime <= 0 ? () => 1 : linear().domain([0, transitionTime]).clamp(true);
      const valueScale = linear().range([originValue, targetValue]).clamp(true);
      this._timer.restart((elapsedTime) => {
        const scaled = timeScale(elapsedTime);
        const eased = cubicInOut(scaled);
        const newValue = valueScale(eased);
        this.real_value = newValue;
        if (now() >= originTime + transitionTime) {
          this._timer.stop();
        }
      });
    }
  }
}

window.customElements.define('steelseries-radial-vertical', RadialVerticalElement);

const drawLinearBackgroundImage = function (
  ctx,
  backgroundColor,
  imageWidth,
  imageHeight,
  vertical
) {
  let i;
  let end;
  let grad;
  let fractions;
  let colors;
  let frameWidth;
  let linBBuffer;
  let linBCtx;
  let radius;
  let turnRadius;
  let centerX;
  let centerY;
  let stepSize;
  let mono;
  let textureColor;
  let texture;
  const cacheKey =
    imageWidth.toString() + imageHeight + vertical + backgroundColor.name;

  // check if we have already created and cached this buffer, if not create it
  if (!drawLinearBackgroundImage.cache[cacheKey]) {
    frameWidth =
      Math.sqrt(imageWidth * imageWidth + imageHeight * imageHeight) * 0.04;
    frameWidth =
      Math.ceil(
        Math.min(frameWidth, (vertical ? imageWidth : imageHeight) * 0.1)
      ) - 1;

    const CORNER_RADIUS = Math.floor(
      (vertical ? imageWidth : imageHeight) * 0.028571
    );
    // Setup buffer
    linBBuffer = createBuffer(imageWidth, imageHeight);
    linBCtx = linBBuffer.getContext('2d');
    linBCtx.lineWidth = 0;

    roundedRectangle(
      linBCtx,
      frameWidth,
      frameWidth,
      imageWidth - frameWidth * 2,
      imageHeight - frameWidth * 2,
      CORNER_RADIUS
    );

    // If the backgroundColor is a texture fill it with the texture instead of the gradient
    if (
      backgroundColor.name === 'CARBON' ||
      backgroundColor.name === 'PUNCHED_SHEET' ||
      backgroundColor.name === 'STAINLESS' ||
      backgroundColor.name === 'BRUSHED_METAL' ||
      backgroundColor.name === 'BRUSHED_STAINLESS' ||
      backgroundColor.name === 'TURNED'
    ) {
      if (backgroundColor.name === 'CARBON') {
        linBCtx.fillStyle = linBCtx.createPattern(carbonBuffer, 'repeat');
        linBCtx.fill();
      }

      if (backgroundColor.name === 'PUNCHED_SHEET') {
        linBCtx.fillStyle = linBCtx.createPattern(punchedSheetBuffer, 'repeat');
        linBCtx.fill();
      }

      if (
        backgroundColor.name === 'STAINLESS' ||
        backgroundColor.name === 'TURNED'
      ) {
        // Define the fraction of the conical gradient paint
        fractions = [
          0,
          0.03,
          0.1,
          0.14,
          0.24,
          0.33,
          0.38,
          0.5,
          0.62,
          0.67,
          0.76,
          0.81,
          0.85,
          0.97,
          1
        ];

        // Define the colors of the conical gradient paint
        colors = [
          new rgbaColor('#FDFDFD'),
          new rgbaColor('#FDFDFD'),
          new rgbaColor('#B2B2B4'),
          new rgbaColor('#ACACAE'),
          new rgbaColor('#FDFDFD'),
          new rgbaColor('#8E8E8E'),
          new rgbaColor('#8E8E8E'),
          new rgbaColor('#FDFDFD'),
          new rgbaColor('#8E8E8E'),
          new rgbaColor('#8E8E8E'),
          new rgbaColor('#FDFDFD'),
          new rgbaColor('#ACACAE'),
          new rgbaColor('#B2B2B4'),
          new rgbaColor('#FDFDFD'),
          new rgbaColor('#FDFDFD')
        ];
        grad = new ConicalGradient(fractions, colors);
        // Set a clip as we will be drawing outside the required area
        linBCtx.clip();
        grad.fillRect(
          linBCtx,
          imageWidth / 2,
          imageHeight / 2,
          imageWidth - frameWidth * 2,
          imageHeight - frameWidth * 2,
          imageWidth / 2,
          imageHeight / 2
        );
        // Add an additional inner shadow to fade out brightness at the top
        grad = linBCtx.createLinearGradient(
          0,
          frameWidth,
          0,
          imageHeight - frameWidth * 2
        );
        grad.addColorStop(0, 'rgba(0, 0, 0, 0.25)');
        grad.addColorStop(0.1, 'rgba(0, 0, 0, 0.05)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        linBCtx.fillStyle = grad;
        linBCtx.fill();

        if (backgroundColor.name === 'TURNED') {
          // Define the turning radius
          radius =
            Math.sqrt(
              (imageWidth - frameWidth * 2) * (imageWidth - frameWidth * 2) +
                (imageHeight - frameWidth * 2) * (imageHeight - frameWidth * 2)
            ) / 2;
          turnRadius = radius * 0.55;
          centerX = imageWidth / 2;
          centerY = imageHeight / 2;
          // Step size proporational to radius
          stepSize = (TWO_PI / 360) * (400 / radius);

          // Save before we start
          linBCtx.save();

          // Set a clip as we will be drawing outside the required area
          roundedRectangle(
            linBCtx,
            frameWidth,
            frameWidth,
            imageWidth - frameWidth * 2,
            imageHeight - frameWidth * 2,
            CORNER_RADIUS
          );
          linBCtx.clip();

          // set the style for the turnings
          linBCtx.lineWidth = 0.5;
          end = TWO_PI - stepSize * 0.3;
          // Step the engine round'n'round
          for (i = 0; i < end; i += stepSize) {
            // draw a 'turn'
            linBCtx.strokeStyle = 'rgba(240, 240, 255, 0.25)';
            linBCtx.beginPath();
            linBCtx.arc(centerX + turnRadius, centerY, turnRadius, 0, TWO_PI);
            linBCtx.stroke();
            // rotate the 'piece'
            linBCtx.translate(centerX, centerY);
            linBCtx.rotate(stepSize * 0.3);
            linBCtx.translate(-centerX, -centerY);
            // draw a 'turn'
            linBCtx.strokeStyle = 'rgba(25, 10, 10, 0.1)';
            linBCtx.beginPath();
            linBCtx.arc(centerX + turnRadius, centerY, turnRadius, 0, TWO_PI);
            linBCtx.stroke();
            linBCtx.translate(centerX, centerY);
            linBCtx.rotate(-stepSize * 0.3);
            linBCtx.translate(-centerX, -centerY);

            // rotate the 'piece'
            linBCtx.translate(centerX, centerY);
            linBCtx.rotate(stepSize);
            linBCtx.translate(-centerX, -centerY);
          }
          // Restore canvas now we are done
          linBCtx.restore();
        }
      }
      // Add an additional inner shadow to make the look more realistic
      grad = linBCtx.createLinearGradient(
        frameWidth,
        frameWidth,
        imageWidth - frameWidth * 2,
        imageHeight - frameWidth * 2
      );
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.25)');
      grad.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
      linBCtx.fillStyle = grad;
      roundedRectangle(
        linBCtx,
        frameWidth,
        frameWidth,
        imageWidth - frameWidth * 2,
        imageHeight - frameWidth * 2,
        CORNER_RADIUS
      );
      linBCtx.fill();

      if (
        backgroundColor.name === 'BRUSHED_METAL' ||
        backgroundColor.name === 'BRUSHED_STAINLESS'
      ) {
        mono = backgroundColor.name === 'BRUSHED_METAL';
        textureColor = parseInt(
          backgroundColor.gradientStop.getHexColor().substr(-6),
          16
        );
        texture = brushedMetalTexture(textureColor, 5, 0.1, mono, 0.5);
        linBCtx.fillStyle = linBCtx.createPattern(
          texture.fill(0, 0, imageWidth, imageHeight),
          'no-repeat'
        );
        linBCtx.fill();
      }
    } else {
      grad = linBCtx.createLinearGradient(
        0,
        frameWidth,
        0,
        imageHeight - frameWidth * 2
      );
      grad.addColorStop(0, backgroundColor.gradientStart.getRgbaColor());
      grad.addColorStop(0.4, backgroundColor.gradientFraction.getRgbaColor());
      grad.addColorStop(1, backgroundColor.gradientStop.getRgbaColor());
      linBCtx.fillStyle = grad;
      linBCtx.fill();
    }
    // Add a simple inner shadow
    colors = [
      'rgba(0, 0, 0, 0.30)',
      'rgba(0, 0, 0, 0.20)',
      'rgba(0, 0, 0, 0.13)',
      'rgba(0, 0, 0, 0.09)',
      'rgba(0, 0, 0, 0.06)',
      'rgba(0, 0, 0, 0.04)',
      'rgba(0, 0, 0, 0.03)'
    ];
    for (i = 0; i < 7; i++) {
      linBCtx.strokeStyle = colors[i];
      roundedRectangle(
        linBCtx,
        frameWidth + i,
        frameWidth + i,
        imageWidth - frameWidth * 2 - 2 * i,
        imageHeight - frameWidth * 2 - 2 * i,
        CORNER_RADIUS
      );
      linBCtx.stroke();
    }
    // cache the buffer
    drawLinearBackgroundImage.cache[cacheKey] = linBBuffer;
  }
  ctx.drawImage(drawLinearBackgroundImage.cache[cacheKey], 0, 0);
  return this
};
drawLinearBackgroundImage.cache = {};

const drawLinearForegroundImage = function (
  ctx,
  imageWidth,
  imageHeight,
  vertical
) {
  let linFgBuffer;
  let linFgCtx;
  let foregroundGradient;
  let frameWidth;
  let fgOffset;
  let fgOffset2;
  const cacheKey = imageWidth.toString() + imageHeight + vertical;

  // check if we have already created and cached this buffer, if not create it
  if (!drawLinearForegroundImage.cache[cacheKey]) {
    // Setup buffer
    linFgBuffer = createBuffer(imageWidth, imageHeight);
    linFgCtx = linFgBuffer.getContext('2d');

    frameWidth =
      Math.sqrt(imageWidth * imageWidth + imageHeight * imageHeight) * 0.04;
    frameWidth = Math.min(
      frameWidth,
      (vertical ? imageWidth : imageHeight) * 0.1
    );
    fgOffset = frameWidth * 1.3;
    fgOffset2 = fgOffset * 1.33;

    linFgCtx.beginPath();
    linFgCtx.moveTo(fgOffset, imageHeight - fgOffset);
    linFgCtx.lineTo(imageWidth - fgOffset, imageHeight - fgOffset);
    linFgCtx.bezierCurveTo(
      imageWidth - fgOffset,
      imageHeight - fgOffset,
      imageWidth - fgOffset2,
      imageHeight * 0.7,
      imageWidth - fgOffset2,
      imageHeight * 0.5
    );
    linFgCtx.bezierCurveTo(
      imageWidth - fgOffset2,
      fgOffset2,
      imageWidth - fgOffset,
      fgOffset,
      imageWidth - frameWidth,
      fgOffset
    );
    linFgCtx.lineTo(fgOffset, fgOffset);
    linFgCtx.bezierCurveTo(
      fgOffset,
      fgOffset,
      fgOffset2,
      imageHeight * 0.285714,
      fgOffset2,
      imageHeight * 0.5
    );
    linFgCtx.bezierCurveTo(
      fgOffset2,
      imageHeight * 0.7,
      fgOffset,
      imageHeight - fgOffset,
      frameWidth,
      imageHeight - fgOffset
    );
    linFgCtx.closePath();

    foregroundGradient = linFgCtx.createLinearGradient(
      0,
      imageHeight - frameWidth,
      0,
      frameWidth
    );
    foregroundGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    foregroundGradient.addColorStop(0.06, 'rgba(255, 255, 255, 0)');
    foregroundGradient.addColorStop(0.07, 'rgba(255, 255, 255, 0)');
    foregroundGradient.addColorStop(0.12, 'rgba(255, 255, 255, 0)');
    foregroundGradient.addColorStop(0.17, 'rgba(255, 255, 255, 0.013546)');
    foregroundGradient.addColorStop(0.1701, 'rgba(255, 255, 255, 0)');
    foregroundGradient.addColorStop(0.79, 'rgba(255, 255, 255, 0)');
    foregroundGradient.addColorStop(0.8, 'rgba(255, 255, 255, 0)');
    foregroundGradient.addColorStop(0.84, 'rgba(255, 255, 255, 0.082217)');
    foregroundGradient.addColorStop(0.93, 'rgba(255, 255, 255, 0.288702)');
    foregroundGradient.addColorStop(0.94, 'rgba(255, 255, 255, 0.298039)');
    foregroundGradient.addColorStop(0.96, 'rgba(255, 255, 255, 0.119213)');
    foregroundGradient.addColorStop(0.97, 'rgba(255, 255, 255, 0)');
    foregroundGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    linFgCtx.fillStyle = foregroundGradient;
    linFgCtx.fill();

    // cache the buffer
    drawLinearForegroundImage.cache[cacheKey] = linFgBuffer;
  }
  ctx.drawImage(drawLinearForegroundImage.cache[cacheKey], 0, 0);
  return this
};
drawLinearForegroundImage.cache = {};

const drawLinearFrameImage = function (
  ctx,
  frameDesign,
  imageWidth,
  imageHeight,
  vertical
) {
  let frameWidth;
  let linFBuffer;
  let linFCtx;
  let OUTER_FRAME_CORNER_RADIUS;
  let FRAME_MAIN_CORNER_RADIUS;
  let SUBTRACT_CORNER_RADIUS;
  let grad;
  let fractions = [];
  let colors = [];
  const cacheKey =
    imageWidth.toString() + imageHeight + frameDesign.design + vertical;

  // check if we have already created and cached this buffer, if not create it
  if (!drawLinearFrameImage.cache[cacheKey]) {
    frameWidth =
      Math.sqrt(imageWidth * imageWidth + imageHeight * imageHeight) * 0.04;
    frameWidth = Math.ceil(
      Math.min(frameWidth, (vertical ? imageWidth : imageHeight) * 0.1)
    );

    // Setup buffer
    linFBuffer = createBuffer(imageWidth, imageHeight);
    linFCtx = linFBuffer.getContext('2d');

    // Calculate corner radii
    if (vertical) {
      OUTER_FRAME_CORNER_RADIUS = Math.ceil(imageWidth * 0.05);
      FRAME_MAIN_CORNER_RADIUS = OUTER_FRAME_CORNER_RADIUS - 1;
      SUBTRACT_CORNER_RADIUS = Math.floor(imageWidth * 0.028571);
    } else {
      OUTER_FRAME_CORNER_RADIUS = Math.ceil(imageHeight * 0.05);
      FRAME_MAIN_CORNER_RADIUS = OUTER_FRAME_CORNER_RADIUS - 1;
      SUBTRACT_CORNER_RADIUS = Math.floor(imageHeight * 0.028571);
    }

    roundedRectangle(
      linFCtx,
      0,
      0,
      imageWidth,
      imageHeight,
      OUTER_FRAME_CORNER_RADIUS
    );
    linFCtx.fillStyle = '#838383';
    linFCtx.fill();

    roundedRectangle(
      linFCtx,
      1,
      1,
      imageWidth - 2,
      imageHeight - 2,
      FRAME_MAIN_CORNER_RADIUS
    );

    // main gradient frame
    switch (frameDesign.design) {
      case 'metal':
        grad = linFCtx.createLinearGradient(
          0,
          imageWidth * 0.004672,
          0,
          imageHeight * 0.990654
        );
        grad.addColorStop(0, '#fefefe');
        grad.addColorStop(0.07, 'rgb(210, 210, 210)');
        grad.addColorStop(0.12, 'rgb(179, 179, 179)');
        grad.addColorStop(1, 'rgb(213, 213, 213)');
        linFCtx.fillStyle = grad;
        linFCtx.fill();
        break

      case 'brass':
        grad = linFCtx.createLinearGradient(
          0,
          imageWidth * 0.004672,
          0,
          imageHeight * 0.990654
        );
        grad.addColorStop(0, 'rgb(249, 243, 155)');
        grad.addColorStop(0.05, 'rgb(246, 226, 101)');
        grad.addColorStop(0.1, 'rgb(240, 225, 132)');
        grad.addColorStop(0.5, 'rgb(90, 57, 22)');
        grad.addColorStop(0.9, 'rgb(249, 237, 139)');
        grad.addColorStop(0.95, 'rgb(243, 226, 108)');
        grad.addColorStop(1, 'rgb(202, 182, 113)');
        linFCtx.fillStyle = grad;
        linFCtx.fill();
        break

      case 'steel':
        grad = linFCtx.createLinearGradient(
          0,
          imageWidth * 0.004672,
          0,
          imageHeight * 0.990654
        );
        grad.addColorStop(0, 'rgb(231, 237, 237)');
        grad.addColorStop(0.05, 'rgb(189, 199, 198)');
        grad.addColorStop(0.1, 'rgb(192, 201, 200)');
        grad.addColorStop(0.5, 'rgb(23, 31, 33)');
        grad.addColorStop(0.9, 'rgb(196, 205, 204)');
        grad.addColorStop(0.95, 'rgb(194, 204, 203)');
        grad.addColorStop(1, 'rgb(189, 201, 199)');
        linFCtx.fillStyle = grad;
        linFCtx.fill();
        break

      case 'gold':
        grad = linFCtx.createLinearGradient(
          0,
          imageWidth * 0.004672,
          0,
          imageHeight * 0.990654
        );
        grad.addColorStop(0, 'rgb(255, 255, 207)');
        grad.addColorStop(0.15, 'rgb(255, 237, 96)');
        grad.addColorStop(0.22, 'rgb(254, 199, 57)');
        grad.addColorStop(0.3, 'rgb(255, 249, 203)');
        grad.addColorStop(0.38, 'rgb(255, 199, 64)');
        grad.addColorStop(0.44, 'rgb(252, 194, 60)');
        grad.addColorStop(0.51, 'rgb(255, 204, 59)');
        grad.addColorStop(0.6, 'rgb(213, 134, 29)');
        grad.addColorStop(0.68, 'rgb(255, 201, 56)');
        grad.addColorStop(0.75, 'rgb(212, 135, 29)');
        grad.addColorStop(1, 'rgb(247, 238, 101)');
        linFCtx.fillStyle = grad;
        linFCtx.fill();
        break

      case 'anthracite':
        grad = linFCtx.createLinearGradient(
          0,
          0.004672 * imageHeight,
          0,
          0.995326 * imageHeight
        );
        grad.addColorStop(0, 'rgb(118, 117, 135)');
        grad.addColorStop(0.06, 'rgb(74, 74, 82)');
        grad.addColorStop(0.12, 'rgb(50, 50, 54)');
        grad.addColorStop(1, 'rgb(79, 79, 87)');
        linFCtx.fillStyle = grad;
        linFCtx.fill();
        break

      case 'tiltedGray':
        grad = linFCtx.createLinearGradient(
          0.233644 * imageWidth,
          0.084112 * imageHeight,
          0.81258 * imageWidth,
          0.910919 * imageHeight
        );
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.07, 'rgb(210, 210, 210)');
        grad.addColorStop(0.16, 'rgb(179, 179, 179)');
        grad.addColorStop(0.33, '#ffffff');
        grad.addColorStop(0.55, '#c5c5c5');
        grad.addColorStop(0.79, '#ffffff');
        grad.addColorStop(1, '#666666');
        linFCtx.fillStyle = grad;
        linFCtx.fill();
        break

      case 'tiltedBlack':
        grad = linFCtx.createLinearGradient(
          0.228971 * imageWidth,
          0.079439 * imageHeight,
          0.802547 * imageWidth,
          0.898591 * imageHeight
        );
        grad.addColorStop(0, '#666666');
        grad.addColorStop(0.21, '#000000');
        grad.addColorStop(0.47, '#666666');
        grad.addColorStop(0.99, '#000000');
        grad.addColorStop(1, '#000000');
        linFCtx.fillStyle = grad;
        linFCtx.fill();
        break

      case 'glossyMetal':
        roundedRectangle(
          linFCtx,
          1,
          1,
          imageWidth - 2,
          imageHeight - 2,
          OUTER_FRAME_CORNER_RADIUS
        );
        linFCtx.clip();
        grad = linFCtx.createLinearGradient(0, 1, 0, imageHeight - 2);
        // The fractions from the Java version of linear gauge
        /*
                    grad.addColorStop(0, 'rgb(249, 249, 249)');
                    grad.addColorStop(0.1, 'rgb(200, 195, 191)');
                    grad.addColorStop(0.26, '#ffffff');
                    grad.addColorStop(0.73, 'rgb(29, 29, 29)');
                    grad.addColorStop(1, 'rgb(209, 209, 209)');
        */
        // Modified fractions from the radial gauge - looks better imho
        grad.addColorStop(0, 'rgb(249, 249, 249)');
        grad.addColorStop(0.2, 'rgb(200, 195, 191)');
        grad.addColorStop(0.3, '#ffffff');
        grad.addColorStop(0.6, 'rgb(29, 29, 29)');
        grad.addColorStop(0.8, 'rgb(200, 194, 192)');
        grad.addColorStop(1, 'rgb(209, 209, 209)');
        linFCtx.fillStyle = grad;
        linFCtx.fill();

        // Inner frame bright
        roundedRectangle(
          linFCtx,
          frameWidth - 2,
          frameWidth - 2,
          imageWidth - (frameWidth - 2) * 2,
          imageHeight - (frameWidth - 2) * 2,
          SUBTRACT_CORNER_RADIUS
        );
        linFCtx.clip();
        linFCtx.fillStyle = '#f6f6f6';
        linFCtx.fill();

        // Inner frame dark
        roundedRectangle(
          linFCtx,
          frameWidth - 1,
          frameWidth - 1,
          imageWidth - (frameWidth - 1) * 2,
          imageHeight - (frameWidth - 1) * 2,
          SUBTRACT_CORNER_RADIUS
        );
        linFCtx.clip();
        linFCtx.fillStyle = '#333333';
        //                linFCtx.fill();
        break

      case 'blackMetal':
        fractions = [0, 0.125, 0.347222, 0.5, 0.680555, 0.875, 1];

        colors = [
          new rgbaColor('#FFFFFF'),
          new rgbaColor('#000000'),
          new rgbaColor('#999999'),
          new rgbaColor('#000000'),
          new rgbaColor('#999999'),
          new rgbaColor('#000000'),
          new rgbaColor('#FFFFFF')
        ];
        // Set the clip
        linFCtx.beginPath();
        roundedRectangle(
          linFCtx,
          1,
          1,
          imageWidth - 2,
          imageHeight - 2,
          OUTER_FRAME_CORNER_RADIUS
        );
        linFCtx.closePath();
        linFCtx.clip();
        grad = new ConicalGradient(fractions, colors);
        grad.fillRect(
          linFCtx,
          imageWidth / 2,
          imageHeight / 2,
          imageWidth,
          imageHeight,
          frameWidth,
          frameWidth
        );
        break

      case 'shinyMetal':
        fractions = [0, 0.125, 0.25, 0.347222, 0.5, 0.652777, 0.75, 0.875, 1];

        colors = [
          new rgbaColor('#FFFFFF'),
          new rgbaColor('#D2D2D2'),
          new rgbaColor('#B3B3B3'),
          new rgbaColor('#EEEEEE'),
          new rgbaColor('#A0A0A0'),
          new rgbaColor('#EEEEEE'),
          new rgbaColor('#B3B3B3'),
          new rgbaColor('#D2D2D2'),
          new rgbaColor('#FFFFFF')
        ];
        // Set the clip
        linFCtx.beginPath();
        roundedRectangle(
          linFCtx,
          1,
          1,
          imageWidth - 2,
          imageHeight - 2,
          OUTER_FRAME_CORNER_RADIUS
        );
        linFCtx.closePath();
        linFCtx.clip();
        grad = new ConicalGradient(fractions, colors);
        grad.fillRect(
          linFCtx,
          imageWidth / 2,
          imageHeight / 2,
          imageWidth,
          imageHeight,
          frameWidth,
          frameWidth
        );
        break

      case 'chrome':
        fractions = [
          0,
          0.09,
          0.12,
          0.16,
          0.25,
          0.29,
          0.33,
          0.38,
          0.48,
          0.52,
          0.63,
          0.68,
          0.8,
          0.83,
          0.87,
          0.97,
          1
        ];

        colors = [
          new rgbaColor('#FFFFFF'),
          new rgbaColor('#FFFFFF'),
          new rgbaColor('#888890'),
          new rgbaColor('#A4B9BE'),
          new rgbaColor('#9EB3B6'),
          new rgbaColor('#707070'),
          new rgbaColor('#DDE3E3'),
          new rgbaColor('#9BB0B3'),
          new rgbaColor('#9CB0B1'),
          new rgbaColor('#FEFFFF'),
          new rgbaColor('#FFFFFF'),
          new rgbaColor('#9CB4B4'),
          new rgbaColor('#C6D1D3'),
          new rgbaColor('#F6F8F7'),
          new rgbaColor('#CCD8D8'),
          new rgbaColor('#A4BCBE'),
          new rgbaColor('#FFFFFF')
        ];
        // Set the clip
        linFCtx.beginPath();
        roundedRectangle(
          linFCtx,
          1,
          1,
          imageWidth - 2,
          imageHeight - 2,
          OUTER_FRAME_CORNER_RADIUS
        );
        linFCtx.closePath();
        linFCtx.clip();
        grad = new ConicalGradient(fractions, colors);
        grad.fillRect(
          linFCtx,
          imageWidth / 2,
          imageHeight / 2,
          imageWidth,
          imageHeight,
          frameWidth,
          frameWidth
        );
        break
    }

    roundedRectangle(
      linFCtx,
      frameWidth,
      frameWidth,
      imageWidth - frameWidth * 2,
      imageHeight - frameWidth * 2,
      SUBTRACT_CORNER_RADIUS
    );
    linFCtx.fillStyle = 'rgb(192, 192, 192)';

    // clip out the center of the frame for transparent backgrounds
    linFCtx.globalCompositeOperation = 'destination-out';
    roundedRectangle(
      linFCtx,
      frameWidth,
      frameWidth,
      imageWidth - frameWidth * 2,
      imageHeight - frameWidth * 2,
      SUBTRACT_CORNER_RADIUS
    );
    linFCtx.fill();

    // cache the buffer
    drawLinearFrameImage.cache[cacheKey] = linFBuffer;
  }
  ctx.drawImage(drawLinearFrameImage.cache[cacheKey], 0, 0);
  return this
};
drawLinearFrameImage.cache = {};

function drawLinear (canvas, parameters) {
  parameters = parameters || {};
  let gaugeType =
    undefined === parameters.gaugeType ? GaugeType.TYPE1 : parameters.gaugeType;
  let width = undefined === parameters.width ? 0 : parameters.width;
  let height = undefined === parameters.height ? 0 : parameters.height;
  let minValue = undefined === parameters.minValue ? 0 : parameters.minValue;
  let maxValue =
    undefined === parameters.maxValue ? minValue + 100 : parameters.maxValue;
  const niceScale =
    undefined === parameters.niceScale ? true : parameters.niceScale;
  let threshold =
    undefined === parameters.threshold
      ? (maxValue - minValue) / 2 + minValue
      : parameters.threshold;
  const titleString =
    undefined === parameters.titleString ? '' : parameters.titleString;
  const unitString =
    undefined === parameters.unitString ? '' : parameters.unitString;
  const frameDesign =
    undefined === parameters.frameDesign
      ? FrameDesign.METAL
      : parameters.frameDesign;
  const frameVisible =
    undefined === parameters.frameVisible ? true : parameters.frameVisible;
  const backgroundColor =
    undefined === parameters.backgroundColor
      ? BackgroundColor.DARK_GRAY
      : parameters.backgroundColor;
  const backgroundVisible =
    undefined === parameters.backgroundVisible
      ? true
      : parameters.backgroundVisible;
  const valueColor =
    undefined === parameters.valueColor ? Color$1.RED : parameters.valueColor;
  const lcdColor =
    undefined === parameters.lcdColor ? LcdColor.STANDARD : parameters.lcdColor;
  const lcdVisible =
    undefined === parameters.lcdVisible ? true : parameters.lcdVisible;
  const lcdDecimals =
    undefined === parameters.lcdDecimals ? 2 : parameters.lcdDecimals;
  const digitalFont =
    undefined === parameters.digitalFont ? false : parameters.digitalFont;
  const ledColor =
    undefined === parameters.ledColor ? LedColor.RED_LED : parameters.ledColor;
  const ledVisible =
    undefined === parameters.ledVisible ? false : parameters.ledVisible;
  const thresholdVisible =
    undefined === parameters.thresholdVisible
      ? true
      : parameters.thresholdVisible;
  const minMeasuredValueVisible =
    undefined === parameters.minMeasuredValueVisible
      ? false
      : parameters.minMeasuredValueVisible;
  const maxMeasuredValueVisible =
    undefined === parameters.maxMeasuredValueVisible
      ? false
      : parameters.maxMeasuredValueVisible;
  const labelNumberFormat =
    undefined === parameters.labelNumberFormat
      ? LabelNumberFormat.STANDARD
      : parameters.labelNumberFormat;
  const foregroundVisible =
    undefined === parameters.foregroundVisible
      ? true
      : parameters.foregroundVisible;
  const playAlarm =
    undefined === parameters.playAlarm ? false : parameters.playAlarm;
  const alarmSound =
    undefined === parameters.alarmSound ? false : parameters.alarmSound;

  // Get the canvas context and clear it
  const mainCtx = getCanvasContext(canvas);
  // Has a size been specified?
  if (width === 0) {
    width = mainCtx.canvas.width;
  }
  if (height === 0) {
    height = mainCtx.canvas.height;
  }

  // Set the size - also clears the canvas
  mainCtx.canvas.width = width;
  mainCtx.canvas.height = height;

  const imageWidth = width;
  const imageHeight = height;
  let audioElement;

  // Create audio tag for alarm sound
  if (playAlarm && alarmSound !== false) {
    audioElement = doc.createElement('audio');
    audioElement.setAttribute('src', alarmSound);
    // audioElement.setAttribute('src', 'js/alarm.mp3');
    audioElement.setAttribute('preload', 'auto');
  }

  let value = parameters.value ?? minValue;

  // Properties
  let minMeasuredValue = maxValue;
  let maxMeasuredValue = minValue;

  // Check gaugeType is 1 or 2
  if (gaugeType.type !== 'type1' && gaugeType.type !== 'type2') {
    gaugeType = GaugeType.TYPE1;
  }

  const vertical = width <= height;

  // Constants
  let ledPosX;
  let ledPosY;
  const ledSize = Math.round((vertical ? height : width) * 0.05);
  const minMaxIndSize = Math.round((vertical ? width : height) * 0.05);
  let stdFont;
  let lcdFont;

  // Misc
  if (vertical) {
    ledPosX = imageWidth / 2 - ledSize / 2;
    ledPosY = (gaugeType.type === 'type1' ? 0.053 : 0.038) * imageHeight;
    stdFont = Math.floor(imageHeight / 22) + 'px ' + stdFontName;
    lcdFont = Math.floor(imageHeight / 22) + 'px ' + lcdFontName;
  } else {
    ledPosX = 0.89 * imageWidth;
    ledPosY = imageHeight / 2 - ledSize / 2;
    stdFont = Math.floor(imageHeight / 10) + 'px ' + stdFontName;
    lcdFont = Math.floor(imageHeight / 10) + 'px ' + lcdFontName;
  }

  let initialized = false;

  // Tickmark specific private variables
  let niceMinValue = minValue;
  let niceMaxValue = maxValue;
  let niceRange = maxValue - minValue;
  let minorTickSpacing = 0;
  let majorTickSpacing = 0;
  const maxNoOfMinorTicks = 10;
  const maxNoOfMajorTicks = 10;

  // Method to calculate nice values for min, max and range for the tickmarks
  const calculate = function calculate () {
    if (niceScale) {
      niceRange = calcNiceNumber(maxValue - minValue, false);
      majorTickSpacing = calcNiceNumber(
        niceRange / (maxNoOfMajorTicks - 1),
        true
      );
      niceMinValue = Math.floor(minValue / majorTickSpacing) * majorTickSpacing;
      niceMaxValue = Math.ceil(maxValue / majorTickSpacing) * majorTickSpacing;
      minorTickSpacing = calcNiceNumber(
        majorTickSpacing / (maxNoOfMinorTicks - 1),
        true
      );
      minValue = niceMinValue;
      maxValue = niceMaxValue;
    } else {
      niceRange = maxValue - minValue;
      niceMinValue = minValue;
      niceMaxValue = maxValue;
      minorTickSpacing = 1;
      majorTickSpacing = 10;
    }
    // Make sure values are still in range
    value = value < minValue ? minValue : value > maxValue ? maxValue : value;
    minMeasuredValue =
      minMeasuredValue < minValue
        ? minValue
        : minMeasuredValue > maxValue
          ? maxValue
          : minMeasuredValue;
    maxMeasuredValue =
      maxMeasuredValue < minValue
        ? minValue
        : maxMeasuredValue > maxValue
          ? maxValue
          : maxMeasuredValue;
    threshold =
      threshold < minValue
        ? minValue
        : threshold > maxValue
          ? maxValue
          : threshold;
  };

  // **************   Buffer creation  ********************
  // Buffer for the frame
  const frameBuffer = createBuffer(width, height);
  const frameContext = frameBuffer.getContext('2d');

  // Buffer for the background
  const backgroundBuffer = createBuffer(width, height);
  const backgroundContext = backgroundBuffer.getContext('2d');

  let lcdBuffer;

  // Buffer for led on painting code
  const ledBufferOn = createBuffer(ledSize, ledSize);
  const ledContextOn = ledBufferOn.getContext('2d');

  // Buffer for led off painting code
  const ledBufferOff = createBuffer(ledSize, ledSize);
  const ledContextOff = ledBufferOff.getContext('2d');

  // Buffer for current led painting code
  const ledBuffer = ledBufferOff;

  // Buffer for the minMeasuredValue indicator
  const minMeasuredValueBuffer = createBuffer(minMaxIndSize, minMaxIndSize);
  const minMeasuredValueCtx = minMeasuredValueBuffer.getContext('2d');

  // Buffer for the maxMeasuredValue indicator
  const maxMeasuredValueBuffer = createBuffer(minMaxIndSize, minMaxIndSize);
  const maxMeasuredValueCtx = maxMeasuredValueBuffer.getContext('2d');

  // Buffer for static foreground painting code
  const foregroundBuffer = createBuffer(width, height);
  const foregroundContext = foregroundBuffer.getContext('2d');

  // **************   Image creation  ********************
  const drawLcdText = function (ctx, value, vertical) {
    ctx.save();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = lcdColor.textColor;
    ctx.fillStyle = lcdColor.textColor;

    if (
      lcdColor === LcdColor.STANDARD ||
      lcdColor === LcdColor.STANDARD_GREEN
    ) {
      ctx.shadowColor = 'gray';
      if (vertical) {
        ctx.shadowOffsetX = imageHeight * 0.003;
        ctx.shadowOffsetY = imageHeight * 0.003;
        ctx.shadowBlur = imageHeight * 0.004;
      } else {
        ctx.shadowOffsetX = imageHeight * 0.007;
        ctx.shadowOffsetY = imageHeight * 0.007;
        ctx.shadowBlur = imageHeight * 0.009;
      }
    }

    let lcdTextX;
    let lcdTextY;
    let lcdTextWidth;

    if (digitalFont) {
      ctx.font = lcdFont;
    } else {
      ctx.font = stdFont;
    }

    if (vertical) {
      lcdTextX =
        (imageWidth - imageWidth * 0.571428) / 2 + imageWidth * 0.571428 - 2;
      lcdTextY = imageHeight * 0.88 + 1 + (imageHeight * 0.055 - 2) / 2;
      lcdTextWidth = imageWidth * 0.7 - 2;
    } else {
      lcdTextX = imageWidth * 0.695 + imageWidth * 0.18 - 2;
      lcdTextY = imageHeight * 0.22 + 1 + (imageHeight * 0.15 - 2) / 2;
      lcdTextWidth = imageHeight * 0.22 - 2;
    }

    ctx.fillText(value.toFixed(lcdDecimals), lcdTextX, lcdTextY, lcdTextWidth);

    ctx.restore();
  };

  const createThresholdImage = function (vertical) {
    const thresholdBuffer = doc.createElement('canvas');
    const thresholdCtx = thresholdBuffer.getContext('2d');
    thresholdBuffer.height = thresholdBuffer.width = minMaxIndSize;

    thresholdCtx.save();
    const gradThreshold = thresholdCtx.createLinearGradient(
      0,
      0.1,
      0,
      thresholdBuffer.height * 0.9
    );
    gradThreshold.addColorStop(0, '#520000');
    gradThreshold.addColorStop(0.3, '#fc1d00');
    gradThreshold.addColorStop(0.59, '#fc1d00');
    gradThreshold.addColorStop(1, '#520000');
    thresholdCtx.fillStyle = gradThreshold;

    if (vertical) {
      thresholdCtx.beginPath();
      thresholdCtx.moveTo(0.1, thresholdBuffer.height * 0.5);
      thresholdCtx.lineTo(thresholdBuffer.width * 0.9, 0.1);
      thresholdCtx.lineTo(
        thresholdBuffer.width * 0.9,
        thresholdBuffer.height * 0.9
      );
      thresholdCtx.closePath();
    } else {
      thresholdCtx.beginPath();
      thresholdCtx.moveTo(0.1, 0.1);
      thresholdCtx.lineTo(thresholdBuffer.width * 0.9, 0.1);
      thresholdCtx.lineTo(
        thresholdBuffer.width * 0.5,
        thresholdBuffer.height * 0.9
      );
      thresholdCtx.closePath();
    }

    thresholdCtx.fill();
    thresholdCtx.strokeStyle = '#FFFFFF';
    thresholdCtx.stroke();

    thresholdCtx.restore();

    return thresholdBuffer
  };

  const drawTickmarksImage = function (ctx, labelNumberFormat, vertical) {
    backgroundColor.labelColor.setAlpha(1);
    ctx.save();
    ctx.textBaseline = 'middle';
    const TEXT_WIDTH = imageWidth * 0.1;
    ctx.strokeStyle = backgroundColor.labelColor.getRgbaColor();
    ctx.fillStyle = backgroundColor.labelColor.getRgbaColor();

    let valueCounter = minValue;
    let majorTickCounter = maxNoOfMinorTicks - 1;
    let tickCounter;
    let currentPos;
    let scaleBoundsX;
    let scaleBoundsY;
    let scaleBoundsW;
    let scaleBoundsH;
    let tickSpaceScaling = 1;

    let minorTickStart;
    let minorTickStop;
    let mediumTickStart;
    let mediumTickStop;
    let majorTickStart;
    let majorTickStop;
    if (vertical) {
      minorTickStart = 0.34 * imageWidth;
      minorTickStop = 0.36 * imageWidth;
      mediumTickStart = 0.33 * imageWidth;
      mediumTickStop = 0.36 * imageWidth;
      majorTickStart = 0.32 * imageWidth;
      majorTickStop = 0.36 * imageWidth;
      ctx.textAlign = 'right';
      scaleBoundsX = 0;
      scaleBoundsY = imageHeight * 0.12864;
      scaleBoundsW = 0;
      if (gaugeType.type === 'type1') {
        scaleBoundsH = imageHeight * 0.856796 - imageHeight * 0.12864;
      } else {
        scaleBoundsH = imageHeight * 0.7475 - imageHeight * 0.12864;
      }
      tickSpaceScaling = scaleBoundsH / (maxValue - minValue);
    } else {
      minorTickStart = 0.65 * imageHeight;
      minorTickStop = 0.63 * imageHeight;
      mediumTickStart = 0.66 * imageHeight;
      mediumTickStop = 0.63 * imageHeight;
      majorTickStart = 0.67 * imageHeight;
      majorTickStop = 0.63 * imageHeight;
      ctx.textAlign = 'center';
      scaleBoundsY = 0;
      if (gaugeType.type === 'type1') {
        scaleBoundsX = imageWidth * 0.142857;
        scaleBoundsW = imageWidth * 0.871012 - scaleBoundsX;
      } else {
        scaleBoundsX = imageWidth * 0.19857;
        scaleBoundsW = imageWidth * 0.82 - scaleBoundsX;
      }
      scaleBoundsH = 0;
      tickSpaceScaling = scaleBoundsW / (maxValue - minValue);
    }

    let labelCounter;
    for (
      labelCounter = minValue, tickCounter = 0;
      labelCounter <= maxValue;
      labelCounter += minorTickSpacing, tickCounter += minorTickSpacing
    ) {
      // Calculate the bounds of the scaling
      if (vertical) {
        currentPos =
          scaleBoundsY + scaleBoundsH - tickCounter * tickSpaceScaling;
      } else {
        currentPos = scaleBoundsX + tickCounter * tickSpaceScaling;
      }

      majorTickCounter++;

      // Draw tickmark every major tickmark spacing
      if (majorTickCounter === maxNoOfMinorTicks) {
        // Draw the major tickmarks
        ctx.lineWidth = 1.5;
        drawLinearTicks(
          ctx,
          majorTickStart,
          majorTickStop,
          currentPos,
          vertical
        );

        // Draw the standard tickmark labels
        if (vertical) {
          // Vertical orientation
          switch (labelNumberFormat.format) {
            case 'fractional':
              ctx.fillText(
                valueCounter.toFixed(2),
                imageWidth * 0.28,
                currentPos,
                TEXT_WIDTH
              );
              break

            case 'scientific':
              ctx.fillText(
                valueCounter.toPrecision(2),
                imageWidth * 0.28,
                currentPos,
                TEXT_WIDTH
              );
              break

            case 'standard':
            /* falls through */
            default:
              ctx.fillText(
                valueCounter.toFixed(0),
                imageWidth * 0.28,
                currentPos,
                TEXT_WIDTH
              );
              break
          }
        } else {
          // Horizontal orientation
          switch (labelNumberFormat.format) {
            case 'fractional':
              ctx.fillText(
                valueCounter.toFixed(2),
                currentPos,
                imageHeight * 0.73,
                TEXT_WIDTH
              );
              break

            case 'scientific':
              ctx.fillText(
                valueCounter.toPrecision(2),
                currentPos,
                imageHeight * 0.73,
                TEXT_WIDTH
              );
              break

            case 'standard':
            /* falls through */
            default:
              ctx.fillText(
                valueCounter.toFixed(0),
                currentPos,
                imageHeight * 0.73,
                TEXT_WIDTH
              );
              break
          }
        }

        valueCounter += majorTickSpacing;
        majorTickCounter = 0;
        continue
      }

      // Draw tickmark every minor tickmark spacing
      if (
        majorTickCounter === maxNoOfMinorTicks / 2
      ) {
        ctx.lineWidth = 1;
        drawLinearTicks(
          ctx,
          mediumTickStart,
          mediumTickStop,
          currentPos,
          vertical
        );
      } else {
        ctx.lineWidth = 0.5;
        drawLinearTicks(
          ctx,
          minorTickStart,
          minorTickStop,
          currentPos,
          vertical
        );
      }
    }

    ctx.restore();
  };

  const drawLinearTicks = function (
    ctx,
    tickStart,
    tickStop,
    currentPos,
    vertical
  ) {
    if (vertical) {
      // Vertical orientation
      ctx.beginPath();
      ctx.moveTo(tickStart, currentPos);
      ctx.lineTo(tickStop, currentPos);
      ctx.closePath();
      ctx.stroke();
    } else {
      // Horizontal orientation
      ctx.beginPath();
      ctx.moveTo(currentPos, tickStart);
      ctx.lineTo(currentPos, tickStop);
      ctx.closePath();
      ctx.stroke();
    }
  };

  // **************   Initialization  ********************
  const init = function (parameters) {
    parameters = parameters || {};
    const drawFrame2 =
      undefined === parameters.frame ? false : parameters.frame;
    const drawBackground2 =
      undefined === parameters.background ? false : parameters.background;
    const drawLed = undefined === parameters.led ? false : parameters.led;
    const drawForeground2 =
      undefined === parameters.foreground ? false : parameters.foreground;

    let yOffset;
    let yRange;
    let valuePos;

    initialized = true;

    // Calculate the current min and max values and the range
    calculate();

    // Create frame in frame buffer (backgroundBuffer)
    if (drawFrame2 && frameVisible) {
      drawLinearFrameImage(
        frameContext,
        frameDesign,
        imageWidth,
        imageHeight,
        vertical
      );
    }

    // Create background in background buffer (backgroundBuffer)
    if (drawBackground2 && backgroundVisible) {
      drawLinearBackgroundImage(
        backgroundContext,
        backgroundColor,
        imageWidth,
        imageHeight,
        vertical
      );
    }

    // draw Thermometer outline
    if (drawBackground2 && gaugeType.type === 'type2') {
      drawBackgroundImage(backgroundContext);
    }

    if (drawLed) {
      if (vertical) {
        // Draw LED ON in ledBuffer_ON
        ledContextOn.drawImage(createLedImage(ledSize, 1, ledColor), 0, 0);

        // Draw LED ON in ledBuffer_OFF
        ledContextOff.drawImage(createLedImage(ledSize, 0, ledColor), 0, 0);
      } else {
        // Draw LED ON in ledBuffer_ON
        ledContextOn.drawImage(createLedImage(ledSize, 1, ledColor), 0, 0);

        // Draw LED ON in ledBuffer_OFF
        ledContextOff.drawImage(createLedImage(ledSize, 0, ledColor), 0, 0);
      }
    }

    // Draw min measured value indicator in minMeasuredValueBuffer
    if (minMeasuredValueVisible) {
      if (vertical) {
        minMeasuredValueCtx.drawImage(
          createMeasuredValueImage(
            minMaxIndSize,
            Color$1.BLUE.dark.getRgbaColor(),
            false,
            vertical
          ),
          0,
          0
        );
      } else {
        minMeasuredValueCtx.drawImage(
          createMeasuredValueImage(
            minMaxIndSize,
            Color$1.BLUE.dark.getRgbaColor(),
            false,
            vertical
          ),
          0,
          0
        );
      }
    }

    // Draw max measured value indicator in maxMeasuredValueBuffer
    if (maxMeasuredValueVisible) {
      if (vertical) {
        maxMeasuredValueCtx.drawImage(
          createMeasuredValueImage(
            minMaxIndSize,
            Color$1.RED.medium.getRgbaColor(),
            false,
            vertical
          ),
          0,
          0
        );
      } else {
        maxMeasuredValueCtx.drawImage(
          createMeasuredValueImage(
            minMaxIndSize,
            Color$1.RED.medium.getRgbaColor(),
            false,
            vertical
          ),
          0,
          0
        );
      }
    }

    // Create alignment posts in background buffer (backgroundBuffer)
    if (drawBackground2 && backgroundVisible) {
      // Create tickmarks in background buffer (backgroundBuffer)
      drawTickmarksImage(backgroundContext, labelNumberFormat, vertical);

      // Create title in background buffer (backgroundBuffer)
      if (vertical) {
        drawTitleImage(
          backgroundContext,
          imageWidth,
          imageHeight,
          titleString,
          unitString,
          backgroundColor,
          vertical,
          null,
          lcdVisible,
          gaugeType
        );
      } else {
        drawTitleImage(
          backgroundContext,
          imageWidth,
          imageHeight,
          titleString,
          unitString,
          backgroundColor,
          vertical,
          null,
          lcdVisible,
          gaugeType
        );
      }
    }

    // Draw threshold image to background context
    if (drawBackground2 && thresholdVisible) {
      backgroundContext.save();
      if (vertical) {
        // Vertical orientation
        yOffset = gaugeType.type === 'type1' ? 0.856796 : 0.7475;
        yRange = yOffset - 0.12864;
        valuePos =
          imageHeight * yOffset -
          (imageHeight * yRange * (threshold - minValue)) /
            (maxValue - minValue);
        backgroundContext.translate(
          imageWidth * 0.365,
          valuePos - minMaxIndSize / 2
        );
      } else {
        // Horizontal orientation
        yOffset = gaugeType.type === 'type1' ? 0.871012 : 0.82;
        yRange = yOffset - (gaugeType.type === 'type1' ? 0.142857 : 0.19857);
        valuePos =
          (imageWidth * yRange * (threshold - minValue)) /
          (maxValue - minValue);
        backgroundContext.translate(
          imageWidth * (gaugeType.type === 'type1' ? 0.142857 : 0.19857) -
            minMaxIndSize / 2 +
            valuePos,
          imageHeight * 0.58
        );
      }
      backgroundContext.drawImage(createThresholdImage(vertical), 0, 0);
      backgroundContext.restore();
    }

    // Create lcd background if selected in background buffer (backgroundBuffer)
    if (drawBackground2 && lcdVisible) {
      if (vertical) {
        lcdBuffer = createLcdBackgroundImage(
          imageWidth * 0.571428,
          imageHeight * 0.055,
          lcdColor
        );
        backgroundContext.drawImage(
          lcdBuffer,
          (imageWidth - imageWidth * 0.571428) / 2,
          imageHeight * 0.88
        );
      } else {
        lcdBuffer = createLcdBackgroundImage(
          imageWidth * 0.18,
          imageHeight * 0.15,
          lcdColor
        );
        backgroundContext.drawImage(
          lcdBuffer,
          imageWidth * 0.695,
          imageHeight * 0.22
        );
      }
    }

    // add thermometer stem foreground
    if (drawForeground2 && gaugeType.type === 'type2') {
      drawForegroundImage(foregroundContext);
    }

    // Create foreground in foreground buffer (foregroundBuffer)
    if (drawForeground2 && foregroundVisible) {
      drawLinearForegroundImage(
        foregroundContext,
        imageWidth,
        imageHeight,
        vertical);
    }
  };

  const drawValue = function (ctx, imageWidth, imageHeight) {
    let top; // position of max value
    let bottom; // position of min value
    const labelColor = backgroundColor.labelColor;
    let fullSize;
    let valueSize;
    let valueTop;
    let valueStartX;
    let valueStartY;
    let valueStopX;
    let valueStopY;
    let valueBackgroundStartX;
    let valueBackgroundStartY;
    let valueBackgroundStopX;
    let valueBackgroundStopY;
    let valueBorderStartX;
    let valueBorderStartY;
    let valueBorderStopX;
    let valueBorderStopY;
    let valueForegroundStartX;
    let valueForegroundStartY;
    let valueForegroundStopX;
    let valueForegroundStopY;

    // Orientation dependend definitions
    if (vertical) {
      // Vertical orientation
      top = imageHeight * 0.12864; // position of max value
      if (gaugeType.type === 'type1') {
        bottom = imageHeight * 0.856796; // position of min value
      } else {
        bottom = imageHeight * 0.7475;
      }
      fullSize = bottom - top;
      valueSize = (fullSize * (value - minValue)) / (maxValue - minValue);
      valueTop = bottom - valueSize;
      valueBackgroundStartX = 0;
      valueBackgroundStartY = top;
      valueBackgroundStopX = 0;
      valueBackgroundStopY = bottom;
    } else {
      // Horizontal orientation
      if (gaugeType.type === 'type1') {
        top = imageWidth * 0.871012; // position of max value
        bottom = imageWidth * 0.142857; // position of min value
      } else {
        top = imageWidth * 0.82; // position of max value
        bottom = imageWidth * 0.19857; // position of min value
      }
      fullSize = top - bottom;
      valueSize = (fullSize * (value - minValue)) / (maxValue - minValue);
      valueTop = bottom;
      valueBackgroundStartX = top;
      valueBackgroundStartY = 0;
      valueBackgroundStopX = bottom;
      valueBackgroundStopY = 0;
    }
    if (gaugeType.type === 'type1') {
      const darker =
        backgroundColor === BackgroundColor.CARBON ||
        backgroundColor === BackgroundColor.PUNCHED_SHEET ||
        backgroundColor === BackgroundColor.STAINLESS ||
        backgroundColor === BackgroundColor.BRUSHED_STAINLESS ||
        backgroundColor === BackgroundColor.TURNED
          ? 0.3
          : 0;
      const valueBackgroundTrackGradient = ctx.createLinearGradient(
        valueBackgroundStartX,
        valueBackgroundStartY,
        valueBackgroundStopX,
        valueBackgroundStopY
      );
      labelColor.setAlpha(0.05 + darker);
      valueBackgroundTrackGradient.addColorStop(0, labelColor.getRgbaColor());
      labelColor.setAlpha(0.15 + darker);
      valueBackgroundTrackGradient.addColorStop(
        0.48,
        labelColor.getRgbaColor()
      );
      labelColor.setAlpha(0.15 + darker);
      valueBackgroundTrackGradient.addColorStop(
        0.49,
        labelColor.getRgbaColor()
      );
      labelColor.setAlpha(0.05 + darker);
      valueBackgroundTrackGradient.addColorStop(1, labelColor.getRgbaColor());
      ctx.fillStyle = valueBackgroundTrackGradient;

      if (vertical) {
        ctx.fillRect(
          imageWidth * 0.435714,
          top,
          imageWidth * 0.142857,
          fullSize
        );
      } else {
        ctx.fillRect(
          imageWidth * 0.142857,
          imageHeight * 0.435714,
          fullSize,
          imageHeight * 0.142857
        );
      }

      if (vertical) {
        // Vertical orientation
        valueBorderStartX = 0;
        valueBorderStartY = top;
        valueBorderStopX = 0;
        valueBorderStopY = top + fullSize;
      } else {
        // Horizontal orientation
        valueBorderStartX = imageWidth * 0.142857 + fullSize;
        valueBorderStartY = 0;
        valueBorderStopX = imageWidth * 0.142857;
        valueBorderStopY = 0;
      }
      const valueBorderGradient = ctx.createLinearGradient(
        valueBorderStartX,
        valueBorderStartY,
        valueBorderStopX,
        valueBorderStopY
      );
      labelColor.setAlpha(0.3 + darker);
      valueBorderGradient.addColorStop(0, labelColor.getRgbaColor());
      labelColor.setAlpha(0.69);
      valueBorderGradient.addColorStop(0.48, labelColor.getRgbaColor());
      labelColor.setAlpha(0.7);
      valueBorderGradient.addColorStop(0.49, labelColor.getRgbaColor());
      labelColor.setAlpha(0.4);
      valueBorderGradient.addColorStop(1, labelColor.getRgbaColor());
      ctx.fillStyle = valueBorderGradient;
      if (vertical) {
        ctx.fillRect(
          imageWidth * 0.435714,
          top,
          imageWidth * 0.007142,
          fullSize
        );
        ctx.fillRect(
          imageWidth * 0.571428,
          top,
          imageWidth * 0.007142,
          fullSize
        );
      } else {
        ctx.fillRect(
          imageWidth * 0.142857,
          imageHeight * 0.435714,
          fullSize,
          imageHeight * 0.007142
        );
        ctx.fillRect(
          imageWidth * 0.142857,
          imageHeight * 0.571428,
          fullSize,
          imageHeight * 0.007142
        );
      }
    }
    if (vertical) {
      // Vertical orientation
      if (gaugeType.type === 'type1') {
        valueStartX = imageWidth * 0.45;
        valueStartY = 0;
        valueStopX = imageWidth * 0.45 + imageWidth * 0.114285;
        valueStopY = 0;
      } else {
        valueStartX = imageWidth / 2 - (imageHeight * 0.0486) / 2;
        valueStartY = 0;
        valueStopX = valueStartX + imageHeight * 0.053;
        valueStopY = 0;
      }
    } else {
      // Horizontal orientation
      if (gaugeType.type === 'type1') {
        valueStartX = 0;
        valueStartY = imageHeight * 0.45;
        valueStopX = 0;
        valueStopY = imageHeight * 0.45 + imageHeight * 0.114285;
      } else {
        valueStartX = 0;
        valueStartY = imageHeight / 2 - imageWidth * 0.025;
        valueStopX = 0;
        valueStopY = valueStartY + imageWidth * 0.053;
      }
    }

    const valueBackgroundGradient = ctx.createLinearGradient(
      valueStartX,
      valueStartY,
      valueStopX,
      valueStopY
    );
    valueBackgroundGradient.addColorStop(0, valueColor.medium.getRgbaColor());
    valueBackgroundGradient.addColorStop(1, valueColor.light.getRgbaColor());
    ctx.fillStyle = valueBackgroundGradient;
    const thermoTweak =
      gaugeType.type === 'type1'
        ? 0
        : vertical
          ? imageHeight * 0.05
          : imageWidth * 0.05;
    if (vertical) {
      ctx.fillRect(
        valueStartX,
        valueTop,
        valueStopX - valueStartX,
        valueSize + thermoTweak
      );
    } else {
      ctx.fillRect(
        valueTop - thermoTweak,
        valueStartY,
        valueSize + thermoTweak,
        valueStopY - valueStartY
      );
    }

    if (gaugeType.type === 'type1') {
      // The light effect on the value
      if (vertical) {
        // Vertical orientation
        valueForegroundStartX = imageWidth * 0.45;
        valueForegroundStartY = 0;
        valueForegroundStopX = valueForegroundStartX + imageWidth * 0.05;
        valueForegroundStopY = 0;
      } else {
        // Horizontal orientation
        valueForegroundStartX = 0;
        valueForegroundStartY = imageHeight * 0.45;
        valueForegroundStopX = 0;
        valueForegroundStopY = valueForegroundStartY + imageHeight * 0.05;
      }
      const valueForegroundGradient = ctx.createLinearGradient(
        valueForegroundStartX,
        valueForegroundStartY,
        valueForegroundStopX,
        valueForegroundStopY
      );
      valueForegroundGradient.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
      valueForegroundGradient.addColorStop(0.98, 'rgba(255, 255, 255, 0.0)');
      ctx.fillStyle = valueForegroundGradient;
      if (vertical) {
        ctx.fillRect(
          valueForegroundStartX,
          valueTop,
          valueForegroundStopX,
          valueSize
        );
      } else {
        ctx.fillRect(
          valueTop,
          valueForegroundStartY,
          valueSize,
          valueForegroundStopY - valueForegroundStartY
        );
      }
    }
  };

  const drawForegroundImage = function (ctx) {
    const foreSize = vertical ? imageHeight : imageWidth;

    ctx.save();
    if (vertical) {
      ctx.translate(imageWidth / 2, 0);
    } else {
      ctx.translate(imageWidth / 2, imageHeight / 2);
      ctx.rotate(HALF_PI);
      ctx.translate(0, -imageWidth / 2 + imageWidth * 0.05);
    }

    // draw bulb
    ctx.beginPath();
    ctx.moveTo(-0.049 * foreSize, 0.825 * foreSize);
    ctx.bezierCurveTo(
      -0.049 * foreSize,
      0.7975 * foreSize,
      -0.0264 * foreSize,
      0.775 * foreSize,
      0.0013 * foreSize,
      0.775 * foreSize
    );
    ctx.bezierCurveTo(
      0.0264 * foreSize,
      0.775 * foreSize,
      0.049 * foreSize,
      0.7975 * foreSize,
      0.049 * foreSize,
      0.825 * foreSize
    );
    ctx.bezierCurveTo(
      0.049 * foreSize,
      0.85 * foreSize,
      0.0264 * foreSize,
      0.8725 * foreSize,
      0.0013 * foreSize,
      0.8725 * foreSize
    );
    ctx.bezierCurveTo(
      -0.0264 * foreSize,
      0.8725 * foreSize,
      -0.049 * foreSize,
      0.85 * foreSize,
      -0.049 * foreSize,
      0.825 * foreSize
    );
    ctx.closePath();
    let grad = ctx.createRadialGradient(
      0 * foreSize,
      0.825 * foreSize,
      0,
      0 * foreSize,
      0.825 * foreSize,
      0.049 * foreSize
    );
    grad.addColorStop(0, valueColor.medium.getRgbaColor());
    grad.addColorStop(0.3, valueColor.medium.getRgbaColor());
    grad.addColorStop(1, valueColor.light.getRgbaColor());
    ctx.fillStyle = grad;
    ctx.fill();

    // draw bulb highlight
    ctx.beginPath();
    if (vertical) {
      ctx.moveTo(-0.0365 * foreSize, 0.8075 * foreSize);
      ctx.bezierCurveTo(
        -0.0365 * foreSize,
        0.7925 * foreSize,
        -0.0214 * foreSize,
        0.7875 * foreSize,
        -0.0214 * foreSize,
        0.7825 * foreSize
      );
      ctx.bezierCurveTo(
        0.0189 * foreSize,
        0.785 * foreSize,
        0.0365 * foreSize,
        0.7925 * foreSize,
        0.0365 * foreSize,
        0.8075 * foreSize
      );
      ctx.bezierCurveTo(
        0.0365 * foreSize,
        0.8175 * foreSize,
        0.0214 * foreSize,
        0.815 * foreSize,
        0.0013 * foreSize,
        0.8125 * foreSize
      );
      ctx.bezierCurveTo(
        -0.0189 * foreSize,
        0.8125 * foreSize,
        -0.0365 * foreSize,
        0.8175 * foreSize,
        -0.0365 * foreSize,
        0.8075 * foreSize
      );
      grad = ctx.createRadialGradient(
        0,
        0.8 * foreSize,
        0,
        0,
        0.8 * foreSize,
        0.0377 * foreSize
      );
    } else {
      ctx.beginPath();
      ctx.moveTo(-0.0214 * foreSize, 0.86 * foreSize);
      ctx.bezierCurveTo(
        -0.0365 * foreSize,
        0.86 * foreSize,
        -0.0415 * foreSize,
        0.845 * foreSize,
        -0.0465 * foreSize,
        0.825 * foreSize
      );
      ctx.bezierCurveTo(
        -0.0465 * foreSize,
        0.805 * foreSize,
        -0.0365 * foreSize,
        0.7875 * foreSize,
        -0.0214 * foreSize,
        0.7875 * foreSize
      );
      ctx.bezierCurveTo(
        -0.0113 * foreSize,
        0.7875 * foreSize,
        -0.0163 * foreSize,
        0.8025 * foreSize,
        -0.0163 * foreSize,
        0.8225 * foreSize
      );
      ctx.bezierCurveTo(
        -0.0163 * foreSize,
        0.8425 * foreSize,
        -0.0113 * foreSize,
        0.86 * foreSize,
        -0.0214 * foreSize,
        0.86 * foreSize
      );
      grad = ctx.createRadialGradient(
        -0.03 * foreSize,
        0.8225 * foreSize,
        0,
        -0.03 * foreSize,
        0.8225 * foreSize,
        0.0377 * foreSize
      );
    }
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 0.55)');
    grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.05)');
    ctx.fillStyle = grad;
    ctx.closePath();
    ctx.fill();

    // stem highlight
    ctx.beginPath();
    ctx.moveTo(-0.0214 * foreSize, 0.115 * foreSize);
    ctx.bezierCurveTo(
      -0.0214 * foreSize,
      0.1075 * foreSize,
      -0.0163 * foreSize,
      0.1025 * foreSize,
      -0.0113 * foreSize,
      0.1025 * foreSize
    );
    ctx.bezierCurveTo(
      -0.0113 * foreSize,
      0.1025 * foreSize,
      -0.0113 * foreSize,
      0.1025 * foreSize,
      -0.0113 * foreSize,
      0.1025 * foreSize
    );
    ctx.bezierCurveTo(
      -0.0038 * foreSize,
      0.1025 * foreSize,
      0.0013 * foreSize,
      0.1075 * foreSize,
      0.0013 * foreSize,
      0.115 * foreSize
    );
    ctx.bezierCurveTo(
      0.0013 * foreSize,
      0.115 * foreSize,
      0.0013 * foreSize,
      0.76 * foreSize,
      0.0013 * foreSize,
      0.76 * foreSize
    );
    ctx.bezierCurveTo(
      0.0013 * foreSize,
      0.7675 * foreSize,
      -0.0038 * foreSize,
      0.7725 * foreSize,
      -0.0113 * foreSize,
      0.7725 * foreSize
    );
    ctx.bezierCurveTo(
      -0.0113 * foreSize,
      0.7725 * foreSize,
      -0.0113 * foreSize,
      0.7725 * foreSize,
      -0.0113 * foreSize,
      0.7725 * foreSize
    );
    ctx.bezierCurveTo(
      -0.0163 * foreSize,
      0.7725 * foreSize,
      -0.0214 * foreSize,
      0.7675 * foreSize,
      -0.0214 * foreSize,
      0.76 * foreSize
    );
    ctx.bezierCurveTo(
      -0.0214 * foreSize,
      0.76 * foreSize,
      -0.0214 * foreSize,
      0.115 * foreSize,
      -0.0214 * foreSize,
      0.115 * foreSize
    );
    ctx.closePath();
    grad = ctx.createLinearGradient(
      -0.0189 * foreSize,
      0,
      0.0013 * foreSize,
      0
    );
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 0.1)');
    grad.addColorStop(0.34, 'rgba(255, 255, 255, 0.5)');
    grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.1)');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.restore();
  };

  const drawBackgroundImage = function (ctx) {
    const backSize = vertical ? imageHeight : imageWidth;
    ctx.save();
    if (vertical) {
      ctx.translate(imageWidth / 2, 0);
    } else {
      ctx.translate(imageWidth / 2, imageHeight / 2);
      ctx.rotate(HALF_PI);
      ctx.translate(0, -imageWidth / 2 + imageWidth * 0.05);
    }
    ctx.beginPath();
    ctx.moveTo(-0.0516 * backSize, 0.825 * backSize);
    ctx.bezierCurveTo(
      -0.0516 * backSize,
      0.8525 * backSize,
      -0.0289 * backSize,
      0.875 * backSize,
      0.0013 * backSize,
      0.875 * backSize
    );
    ctx.bezierCurveTo(
      0.0289 * backSize,
      0.875 * backSize,
      0.0516 * backSize,
      0.8525 * backSize,
      0.0516 * backSize,
      0.825 * backSize
    );
    ctx.bezierCurveTo(
      0.0516 * backSize,
      0.8075 * backSize,
      0.044 * backSize,
      0.7925 * backSize,
      0.0314 * backSize,
      0.7825 * backSize
    );
    ctx.bezierCurveTo(
      0.0314 * backSize,
      0.7825 * backSize,
      0.0314 * backSize,
      0.12 * backSize,
      0.0314 * backSize,
      0.12 * backSize
    );
    ctx.bezierCurveTo(
      0.0314 * backSize,
      0.1025 * backSize,
      0.0189 * backSize,
      0.0875 * backSize,
      0.0013 * backSize,
      0.0875 * backSize
    );
    ctx.bezierCurveTo(
      -0.0163 * backSize,
      0.0875 * backSize,
      -0.0289 * backSize,
      0.1025 * backSize,
      -0.0289 * backSize,
      0.12 * backSize
    );
    ctx.bezierCurveTo(
      -0.0289 * backSize,
      0.12 * backSize,
      -0.0289 * backSize,
      0.7825 * backSize,
      -0.0289 * backSize,
      0.7825 * backSize
    );
    ctx.bezierCurveTo(
      -0.0415 * backSize,
      0.79 * backSize,
      -0.0516 * backSize,
      0.805 * backSize,
      -0.0516 * backSize,
      0.825 * backSize
    );
    ctx.closePath();
    const grad = ctx.createLinearGradient(
      -0.0163 * backSize,
      0,
      0.0289 * backSize,
      0
    );
    grad.addColorStop(0, 'rgba(226, 226, 226, 0.5)');
    grad.addColorStop(0.5, 'rgba(226, 226, 226, 0.2)');
    grad.addColorStop(1, 'rgba(226, 226, 226, 0.5)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(153, 153, 153, 0.5)';
    ctx.stroke();
    ctx.restore();
  };

  const repaint = function () {
    if (!initialized) {
      init({
        frame: true,
        background: true,
        led: true,
        foreground: true
      });
    }

    mainCtx.clearRect(0, 0, mainCtx.canvas.width, mainCtx.canvas.height);

    // Draw frame
    if (frameVisible) {
      mainCtx.drawImage(frameBuffer, 0, 0);
    }

    // Draw buffered image to visible canvas
    mainCtx.drawImage(backgroundBuffer, 0, 0);

    // Draw lcd display
    if (lcdVisible) {
      drawLcdText(mainCtx, value, vertical);
    }

    // Draw led
    if (ledVisible) {
      mainCtx.drawImage(ledBuffer, ledPosX, ledPosY);
    }

    let valuePos;
    let yOffset;
    let yRange;
    let minMaxX;
    let minMaxY;
    // Draw min measured value indicator
    if (minMeasuredValueVisible) {
      if (vertical) {
        yOffset = gaugeType.type === 'type1' ? 0.856796 : 0.7475;
        yRange = yOffset - 0.12864;
        valuePos =
          imageHeight * yOffset -
          (imageHeight * yRange * (minMeasuredValue - minValue)) /
            (maxValue - minValue);
        minMaxX = imageWidth * 0.34 - minMeasuredValueBuffer.width;
        minMaxY = valuePos - minMeasuredValueBuffer.height / 2;
      } else {
        yOffset = gaugeType.type === 'type1' ? 0.871012 : 0.82;
        yRange = yOffset - (gaugeType.type === 'type1' ? 0.142857 : 0.19857);
        valuePos =
          (imageWidth * yRange * (minMeasuredValue - minValue)) /
          (maxValue - minValue);
        minMaxX =
          imageWidth * (gaugeType.type === 'type1' ? 0.142857 : 0.19857) -
          minMeasuredValueBuffer.height / 2 +
          valuePos;
        minMaxY = imageHeight * 0.65;
      }
      mainCtx.drawImage(minMeasuredValueBuffer, minMaxX, minMaxY);
    }

    // Draw max measured value indicator
    if (maxMeasuredValueVisible) {
      if (vertical) {
        valuePos =
          imageHeight * yOffset -
          (imageHeight * yRange * (maxMeasuredValue - minValue)) /
            (maxValue - minValue);
        minMaxX = imageWidth * 0.34 - maxMeasuredValueBuffer.width;
        minMaxY = valuePos - maxMeasuredValueBuffer.height / 2;
      } else {
        yOffset = gaugeType.type === 'type1' ? 0.871012 : 0.8;
        yRange = yOffset - (gaugeType.type === 'type1' ? 0.14857 : 0.19857);
        valuePos =
          (imageWidth * yRange * (maxMeasuredValue - minValue)) /
          (maxValue - minValue);
        minMaxX =
          imageWidth * (gaugeType.type === 'type1' ? 0.142857 : 0.19857) -
          maxMeasuredValueBuffer.height / 2 +
          valuePos;
        minMaxY = imageHeight * 0.65;
      }
      mainCtx.drawImage(maxMeasuredValueBuffer, minMaxX, minMaxY);
    }

    mainCtx.save();
    drawValue(mainCtx, imageWidth, imageHeight);
    mainCtx.restore();

    // Draw foreground
    if (foregroundVisible || gaugeType.type === 'type2') {
      mainCtx.drawImage(foregroundBuffer, 0, 0);
    }
  };

  // Visualize the component
  repaint();
}

class LinearElement extends BaseElement {
  static get drawFunction () { return drawLinear }

  static get properties () {
    return {
      width: { type: Number, defaultValue: 125 },
      height: { type: Number, defaultValue: 200 },
      value: { type: Number, defaultValue: 0 },
      real_value: { state: true },
      transitionTime: { type: Number, defaultValue: 500 },
      minValue: { type: Number, defaultValue: 0 },
      maxValue: { type: Number, defaultValue: 100 },
      threshold: { type: Number, defaultValue: 50 },
      gaugeType: { type: String, objectEnum: GaugeType, defaultValue: 'TYPE1' },
      noNiceScale: { type: Boolean, defaultValue: false },
      titleString: { type: String, defaultValue: '' },
      unitString: { type: String, defaultValue: '' },
      frameDesign: { type: String, objectEnum: FrameDesign, defaultValue: 'METAL' },
      noFrameVisible: { type: Boolean, defaultValue: false },
      backgroundColor: { type: String, objectEnum: BackgroundColor, defaultValue: 'DARK_GRAY' },
      noBackgroundVisible: { type: Boolean, defaultValue: false },
      valueColor: { type: String, objectEnum: Color$1, defaultValue: 'RED' },
      lcdColor: { type: String, objectEnum: LcdColor, defaultValue: 'STANDARD' },
      noLcdVisible: { type: Boolean, defaultValue: false },
      lcdDecimals: { type: Number, defaultValue: 2 },
      digitalFont: { type: Boolean, defaultValue: false },
      thresholdVisible: { type: Boolean, defaultValue: false },
      minMeasuredValueVisible: { type: Boolean, defaultValue: false },
      maxMeasuredValueVisible: { type: Boolean, defaultValue: false },
      labelNumberFormat: { type: String, objectEnum: LabelNumberFormat, defaultValue: 'STANDARD' },
      noForegroundVisible: { type: Boolean, defaultValue: false }
    }
  }

  constructor () {
    super();
    this._timer = timer(() => {});
    this._timer.stop();
  }

  connectedCallback () {
    super.connectedCallback();
    this.real_value = this.real_value ?? this.minValue;
  }

  render () {
    return $`
      <canvas width="${this.width}" height="${this.height}"></canvas>
    `
  }

  updated (changedProperties) {
    super.updated();
    if (changedProperties.has('value') || changedProperties.has('transitionTime')) {
      const transitionTime = this.transitionTime;
      const originTime = now();
      const originValue = this.real_value;
      const targetValue = this.value;
      const timeScale = transitionTime <= 0 ? () => 1 : linear().domain([0, transitionTime]).clamp(true);
      const valueScale = linear().range([originValue, targetValue]).clamp(true);
      this._timer.restart((elapsedTime) => {
        const scaled = timeScale(elapsedTime);
        const eased = cubicInOut(scaled);
        const newValue = valueScale(eased);
        this.real_value = newValue;
        if (now() >= originTime + transitionTime) {
          this._timer.stop();
        }
      });
    }
  }
}

window.customElements.define('steelseries-linear', LinearElement);

function drawLinearBargraph (canvas, parameters) {
  parameters = parameters || {};
  let width = undefined === parameters.width ? 0 : parameters.width;
  let height = undefined === parameters.height ? 0 : parameters.height;
  let minValue = undefined === parameters.minValue ? 0 : parameters.minValue;
  let maxValue =
    undefined === parameters.maxValue ? minValue + 100 : parameters.maxValue;
  const section = undefined === parameters.section ? null : parameters.section;
  const niceScale =
    undefined === parameters.niceScale ? true : parameters.niceScale;
  let threshold =
    undefined === parameters.threshold
      ? (maxValue - minValue) / 2 + minValue
      : parameters.threshold;
  const titleString =
    undefined === parameters.titleString ? '' : parameters.titleString;
  const unitString =
    undefined === parameters.unitString ? '' : parameters.unitString;
  const frameDesign =
    undefined === parameters.frameDesign
      ? FrameDesign.METAL
      : parameters.frameDesign;
  const frameVisible =
    undefined === parameters.frameVisible ? true : parameters.frameVisible;
  const backgroundColor =
    undefined === parameters.backgroundColor
      ? BackgroundColor.DARK_GRAY
      : parameters.backgroundColor;
  const backgroundVisible =
    undefined === parameters.backgroundVisible
      ? true
      : parameters.backgroundVisible;
  const valueColor =
    undefined === parameters.valueColor ? Color$1.RED : parameters.valueColor;
  const lcdColor =
    undefined === parameters.lcdColor ? LcdColor.STANDARD : parameters.lcdColor;
  const lcdVisible =
    undefined === parameters.lcdVisible ? true : parameters.lcdVisible;
  const lcdDecimals =
    undefined === parameters.lcdDecimals ? 2 : parameters.lcdDecimals;
  const digitalFont =
    undefined === parameters.digitalFont ? false : parameters.digitalFont;
  const ledColor =
    undefined === parameters.ledColor ? LedColor.RED_LED : parameters.ledColor;
  const ledVisible =
    undefined === parameters.ledVisible ? false : parameters.ledVisible;
  const thresholdVisible =
    undefined === parameters.thresholdVisible
      ? true
      : parameters.thresholdVisible;
  const minMeasuredValueVisible =
    undefined === parameters.minMeasuredValueVisible
      ? false
      : parameters.minMeasuredValueVisible;
  const maxMeasuredValueVisible =
    undefined === parameters.maxMeasuredValueVisible
      ? false
      : parameters.maxMeasuredValueVisible;
  const labelNumberFormat =
    undefined === parameters.labelNumberFormat
      ? LabelNumberFormat.STANDARD
      : parameters.labelNumberFormat;
  const foregroundVisible =
    undefined === parameters.foregroundVisible
      ? true
      : parameters.foregroundVisible;
  const playAlarm =
    undefined === parameters.playAlarm ? false : parameters.playAlarm;
  const alarmSound =
    undefined === parameters.alarmSound ? false : parameters.alarmSound;
  const valueGradient =
    undefined === parameters.valueGradient ? null : parameters.valueGradient;
  const useValueGradient =
    undefined === parameters.useValueGradient
      ? false
      : parameters.useValueGradient;

  // Get the canvas context and clear it
  const mainCtx = getCanvasContext(canvas);
  // Has a size been specified?
  if (width === 0) {
    width = mainCtx.canvas.width;
  }
  if (height === 0) {
    height = mainCtx.canvas.height;
  }

  // Set the size - also clears the canvas
  mainCtx.canvas.width = width;
  mainCtx.canvas.height = height;

  const imageWidth = width;
  const imageHeight = height;

  let audioElement;

  // Create audio tag for alarm sound
  if (playAlarm && alarmSound !== false) {
    audioElement = doc.createElement('audio');
    audioElement.setAttribute('src', alarmSound);
    audioElement.setAttribute('preload', 'auto');
  }

  let value = parameters.value ?? minValue;

  // Properties
  let minMeasuredValue = maxValue;
  let maxMeasuredValue = minValue;

  let isSectionsVisible = false;
  let isGradientVisible = false;
  let sectionPixels = [];

  const vertical = width <= height;

  // Constants
  let ledPosX;
  let ledPosY;
  const ledSize = Math.round((vertical ? height : width) * 0.05);
  const minMaxIndSize = Math.round((vertical ? width : height) * 0.05);
  let stdFont;
  let lcdFont;

  if (vertical) {
    ledPosX = imageWidth / 2 - ledSize / 2;
    ledPosY = 0.053 * imageHeight;
    stdFont = Math.floor(imageHeight / 22) + 'px ' + stdFontName;
    lcdFont = Math.floor(imageHeight / 22) + 'px ' + lcdFontName;
  } else {
    ledPosX = 0.89 * imageWidth;
    ledPosY = imageHeight / 1.95 - ledSize / 2;
    stdFont = Math.floor(imageHeight / 10) + 'px ' + stdFontName;
    lcdFont = Math.floor(imageHeight / 10) + 'px ' + lcdFontName;
  }

  let initialized = false;

  // Tickmark specific private variables
  let niceMinValue = minValue;
  let niceMaxValue = maxValue;
  let niceRange = maxValue - minValue;
  let minorTickSpacing = 0;
  let majorTickSpacing = 0;
  const maxNoOfMinorTicks = 10;
  const maxNoOfMajorTicks = 10;

  // Method to calculate nice values for min, max and range for the tickmarks
  const calculate = function calculate () {
    if (niceScale) {
      niceRange = calcNiceNumber(maxValue - minValue, false);
      majorTickSpacing = calcNiceNumber(
        niceRange / (maxNoOfMajorTicks - 1),
        true
      );
      niceMinValue = Math.floor(minValue / majorTickSpacing) * majorTickSpacing;
      niceMaxValue = Math.ceil(maxValue / majorTickSpacing) * majorTickSpacing;
      minorTickSpacing = calcNiceNumber(
        majorTickSpacing / (maxNoOfMinorTicks - 1),
        true
      );
      minValue = niceMinValue;
      maxValue = niceMaxValue;
    } else {
      niceRange = maxValue - minValue;
      niceMinValue = minValue;
      niceMaxValue = maxValue;
      minorTickSpacing = 1;
      majorTickSpacing = 10;
    }
    // Make sure values are still in range
    value = value < minValue ? minValue : value > maxValue ? maxValue : value;
    minMeasuredValue =
      minMeasuredValue < minValue
        ? minValue
        : minMeasuredValue > maxValue
          ? maxValue
          : minMeasuredValue;
    maxMeasuredValue =
      maxMeasuredValue < minValue
        ? minValue
        : maxMeasuredValue > maxValue
          ? maxValue
          : maxMeasuredValue;
    threshold =
      threshold < minValue
        ? minValue
        : threshold > maxValue
          ? maxValue
          : threshold;
  };

  // **************   Buffer creation  ********************
  // Buffer for the frame
  const frameBuffer = createBuffer(width, height);
  const frameContext = frameBuffer.getContext('2d');

  // Buffer for the background
  const backgroundBuffer = createBuffer(width, height);
  const backgroundContext = backgroundBuffer.getContext('2d');

  let lcdBuffer;

  // Buffer for active bargraph led
  const activeLedBuffer = doc.createElement('canvas');
  if (vertical) {
    activeLedBuffer.width = imageWidth * 0.121428;
    activeLedBuffer.height = imageHeight * 0.012135;
  } else {
    activeLedBuffer.width = imageWidth * 0.012135;
    activeLedBuffer.height = imageHeight * 0.121428;
  }
  const activeLedContext = activeLedBuffer.getContext('2d');

  // Buffer for active bargraph led
  const inActiveLedBuffer = doc.createElement('canvas');
  if (vertical) {
    inActiveLedBuffer.width = imageWidth * 0.121428;
    inActiveLedBuffer.height = imageHeight * 0.012135;
  } else {
    inActiveLedBuffer.width = imageWidth * 0.012135;
    inActiveLedBuffer.height = imageHeight * 0.121428;
  }
  const inActiveLedContext = inActiveLedBuffer.getContext('2d');

  // Buffer for led on painting code
  const ledBufferOn = createBuffer(ledSize, ledSize);
  const ledContextOn = ledBufferOn.getContext('2d');

  // Buffer for led off painting code
  const ledBufferOff = createBuffer(ledSize, ledSize);
  const ledContextOff = ledBufferOff.getContext('2d');

  // Buffer for current led painting code
  const ledBuffer = ledBufferOff;

  // Buffer for the minMeasuredValue indicator
  const minMeasuredValueBuffer = createBuffer(minMaxIndSize, minMaxIndSize);
  const minMeasuredValueCtx = minMeasuredValueBuffer.getContext('2d');

  // Buffer for the maxMeasuredValue indicator
  const maxMeasuredValueBuffer = createBuffer(minMaxIndSize, minMaxIndSize);
  const maxMeasuredValueCtx = maxMeasuredValueBuffer.getContext('2d');

  // Buffer for static foreground painting code
  const foregroundBuffer = createBuffer(width, height);
  const foregroundContext = foregroundBuffer.getContext('2d');

  // **************   Image creation  ********************
  const drawLcdText = function (ctx, value, vertical) {
    ctx.save();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = lcdColor.textColor;
    ctx.fillStyle = lcdColor.textColor;

    if (
      lcdColor === LcdColor.STANDARD ||
      lcdColor === LcdColor.STANDARD_GREEN
    ) {
      ctx.shadowColor = 'gray';
      if (vertical) {
        ctx.shadowOffsetX = imageWidth * 0.007;
        ctx.shadowOffsetY = imageWidth * 0.007;
        ctx.shadowBlur = imageWidth * 0.009;
      } else {
        ctx.shadowOffsetX = imageHeight * 0.007;
        ctx.shadowOffsetY = imageHeight * 0.007;
        ctx.shadowBlur = imageHeight * 0.009;
      }
    }

    let lcdTextX;
    let lcdTextY;
    let lcdTextWidth;

    if (digitalFont) {
      ctx.font = lcdFont;
    } else {
      ctx.font = stdFont;
    }

    if (vertical) {
      lcdTextX =
        (imageWidth - imageWidth * 0.571428) / 2 +
        1 +
        imageWidth * 0.571428 -
        2;
      lcdTextY = imageHeight * 0.88 + 1 + (imageHeight * 0.055 - 2) / 2;
      lcdTextWidth = imageWidth * 0.7 - 2;
    } else {
      lcdTextX = imageWidth * 0.695 + imageWidth * 0.18 - 2;
      lcdTextY = imageHeight * 0.22 + 1 + (imageHeight * 0.15 - 2) / 2;
      lcdTextWidth = imageHeight * 0.22 - 2;
    }

    ctx.fillText(value.toFixed(lcdDecimals), lcdTextX, lcdTextY, lcdTextWidth);

    ctx.restore();
  };

  const createThresholdImage = function (vertical) {
    const thresholdBuffer = doc.createElement('canvas');
    thresholdBuffer.height = thresholdBuffer.width = minMaxIndSize;
    const thresholdCtx = thresholdBuffer.getContext('2d');

    thresholdCtx.save();
    const gradThreshold = thresholdCtx.createLinearGradient(
      0,
      0.1,
      0,
      thresholdBuffer.height * 0.9
    );
    gradThreshold.addColorStop(0, '#520000');
    gradThreshold.addColorStop(0.3, '#fc1d00');
    gradThreshold.addColorStop(0.59, '#fc1d00');
    gradThreshold.addColorStop(1, '#520000');
    thresholdCtx.fillStyle = gradThreshold;

    if (vertical) {
      thresholdCtx.beginPath();
      thresholdCtx.moveTo(0.1, thresholdBuffer.height * 0.5);
      thresholdCtx.lineTo(thresholdBuffer.width * 0.9, 0.1);
      thresholdCtx.lineTo(
        thresholdBuffer.width * 0.9,
        thresholdBuffer.height * 0.9
      );
      thresholdCtx.closePath();
    } else {
      thresholdCtx.beginPath();
      thresholdCtx.moveTo(0.1, 0.1);
      thresholdCtx.lineTo(thresholdBuffer.width * 0.9, 0.1);
      thresholdCtx.lineTo(
        thresholdBuffer.width * 0.5,
        thresholdBuffer.height * 0.9
      );
      thresholdCtx.closePath();
    }

    thresholdCtx.fill();
    thresholdCtx.strokeStyle = '#FFFFFF';
    thresholdCtx.stroke();

    thresholdCtx.restore();

    return thresholdBuffer
  };

  const drawTickmarksImage = function (ctx, labelNumberFormat, vertical) {
    backgroundColor.labelColor.setAlpha(1);
    ctx.save();
    ctx.textBaseline = 'middle';
    const TEXT_WIDTH = imageWidth * 0.1;
    ctx.strokeStyle = backgroundColor.labelColor.getRgbaColor();
    ctx.fillStyle = backgroundColor.labelColor.getRgbaColor();

    let valueCounter = minValue;
    let majorTickCounter = maxNoOfMinorTicks - 1;
    let tickCounter;
    let currentPos;
    let scaleBoundsX;
    let scaleBoundsY;
    let scaleBoundsW;
    let scaleBoundsH;
    let tickSpaceScaling = 1;

    let minorTickStart;
    let minorTickStop;
    let mediumTickStart;
    let mediumTickStop;
    let majorTickStart;
    let majorTickStop;
    if (vertical) {
      minorTickStart = 0.34 * imageWidth;
      minorTickStop = 0.36 * imageWidth;
      mediumTickStart = 0.33 * imageWidth;
      mediumTickStop = 0.36 * imageWidth;
      majorTickStart = 0.32 * imageWidth;
      majorTickStop = 0.36 * imageWidth;
      ctx.textAlign = 'right';
      scaleBoundsX = 0;
      scaleBoundsY = imageHeight * 0.12864;
      scaleBoundsW = 0;
      scaleBoundsH = imageHeight * 0.856796 - imageHeight * 0.12864;
      tickSpaceScaling = scaleBoundsH / (maxValue - minValue);
    } else {
      minorTickStart = 0.65 * imageHeight;
      minorTickStop = 0.63 * imageHeight;
      mediumTickStart = 0.66 * imageHeight;
      mediumTickStop = 0.63 * imageHeight;
      majorTickStart = 0.67 * imageHeight;
      majorTickStop = 0.63 * imageHeight;
      ctx.textAlign = 'center';
      scaleBoundsX = imageWidth * 0.142857;
      scaleBoundsY = 0;
      scaleBoundsW = imageWidth * 0.871012 - imageWidth * 0.142857;
      scaleBoundsH = 0;
      tickSpaceScaling = scaleBoundsW / (maxValue - minValue);
    }

    let labelCounter;
    for (
      labelCounter = minValue, tickCounter = 0;
      labelCounter <= maxValue;
      labelCounter += minorTickSpacing, tickCounter += minorTickSpacing
    ) {
      // Calculate the bounds of the scaling
      if (vertical) {
        currentPos =
          scaleBoundsY + scaleBoundsH - tickCounter * tickSpaceScaling;
      } else {
        currentPos = scaleBoundsX + tickCounter * tickSpaceScaling;
      }

      majorTickCounter++;

      // Draw tickmark every major tickmark spacing
      if (majorTickCounter === maxNoOfMinorTicks) {
        // Draw the major tickmarks
        ctx.lineWidth = 1.5;
        drawLinearTicks(
          ctx,
          majorTickStart,
          majorTickStop,
          currentPos,
          vertical
        );

        // Draw the standard tickmark labels
        if (vertical) {
          // Vertical orientation
          switch (labelNumberFormat.format) {
            case 'fractional':
              ctx.fillText(
                valueCounter.toFixed(2),
                imageWidth * 0.28,
                currentPos,
                TEXT_WIDTH
              );
              break

            case 'scientific':
              ctx.fillText(
                valueCounter.toPrecision(2),
                imageWidth * 0.28,
                currentPos,
                TEXT_WIDTH
              );
              break

            case 'standard':
            /* falls through */
            default:
              ctx.fillText(
                valueCounter.toFixed(0),
                imageWidth * 0.28,
                currentPos,
                TEXT_WIDTH
              );
              break
          }
        } else {
          // Horizontal orientation
          switch (labelNumberFormat.format) {
            case 'fractional':
              ctx.fillText(
                valueCounter.toFixed(2),
                currentPos,
                imageHeight * 0.73,
                TEXT_WIDTH
              );
              break

            case 'scientific':
              ctx.fillText(
                valueCounter.toPrecision(2),
                currentPos,
                imageHeight * 0.73,
                TEXT_WIDTH
              );
              break

            case 'standard':
            /* falls through */
            default:
              ctx.fillText(
                valueCounter.toFixed(0),
                currentPos,
                imageHeight * 0.73,
                TEXT_WIDTH
              );
              break
          }
        }

        valueCounter += majorTickSpacing;
        majorTickCounter = 0;
        continue
      }

      // Draw tickmark every minor tickmark spacing
      if (
        majorTickCounter === maxNoOfMinorTicks / 2
      ) {
        ctx.lineWidth = 1;
        drawLinearTicks(
          ctx,
          mediumTickStart,
          mediumTickStop,
          currentPos,
          vertical
        );
      } else {
        ctx.lineWidth = 0.5;
        drawLinearTicks(
          ctx,
          minorTickStart,
          minorTickStop,
          currentPos,
          vertical
        );
      }
    }

    ctx.restore();
  };

  const drawLinearTicks = function (
    ctx,
    tickStart,
    tickStop,
    currentPos,
    vertical
  ) {
    if (vertical) {
      // Vertical orientation
      ctx.beginPath();
      ctx.moveTo(tickStart, currentPos);
      ctx.lineTo(tickStop, currentPos);
      ctx.closePath();
      ctx.stroke();
    } else {
      // Horizontal orientation
      ctx.beginPath();
      ctx.moveTo(currentPos, tickStart);
      ctx.lineTo(currentPos, tickStop);
      ctx.closePath();
      ctx.stroke();
    }
  };

  // **************   Initialization  ********************
  const init = function (parameters) {
    parameters = parameters || {};
    const drawFrame2 =
      undefined === parameters.frame ? false : parameters.frame;
    const drawBackground2 =
      undefined === parameters.background ? false : parameters.background;
    const drawLed = undefined === parameters.led ? false : parameters.led;
    const drawForeground2 =
      undefined === parameters.foreground ? false : parameters.foreground;
    const drawBargraphLed =
      undefined === parameters.bargraphled ? false : parameters.bargraphled;

    initialized = true;

    // Calculate the current min and max values and the range
    calculate();

    // Create frame in frame buffer (backgroundBuffer)
    if (drawFrame2 && frameVisible) {
      drawLinearFrameImage(
        frameContext,
        frameDesign,
        imageWidth,
        imageHeight,
        vertical
      );
    }

    // Create background in background buffer (backgroundBuffer)
    if (drawBackground2 && backgroundVisible) {
      drawLinearBackgroundImage(
        backgroundContext,
        backgroundColor,
        imageWidth,
        imageHeight,
        vertical
      );
    }

    if (drawLed) {
      if (vertical) {
        // Draw LED ON in ledBuffer_ON
        ledContextOn.drawImage(createLedImage(ledSize, 1, ledColor), 0, 0);

        // Draw LED ON in ledBuffer_OFF
        ledContextOff.drawImage(createLedImage(ledSize, 0, ledColor), 0, 0);
      } else {
        // Draw LED ON in ledBuffer_ON
        ledContextOn.drawImage(createLedImage(ledSize, 1, ledColor), 0, 0);

        // Draw LED ON in ledBuffer_OFF
        ledContextOff.drawImage(createLedImage(ledSize, 0, ledColor), 0, 0);
      }
    }

    // Draw min measured value indicator in minMeasuredValueBuffer
    if (minMeasuredValueVisible) {
      if (vertical) {
        minMeasuredValueCtx.drawImage(
          createMeasuredValueImage(
            minMaxIndSize,
            Color$1.BLUE.dark.getRgbaColor(),
            false,
            vertical
          ),
          0,
          0
        );
      } else {
        minMeasuredValueCtx.drawImage(
          createMeasuredValueImage(
            minMaxIndSize,
            Color$1.BLUE.dark.getRgbaColor(),
            false,
            vertical
          ),
          0,
          0
        );
      }
    }

    // Draw max measured value indicator in maxMeasuredValueBuffer
    if (maxMeasuredValueVisible) {
      if (vertical) {
        maxMeasuredValueCtx.drawImage(
          createMeasuredValueImage(
            minMaxIndSize,
            Color$1.RED.medium.getRgbaColor(),
            false,
            vertical
          ),
          0,
          0
        );
      } else {
        maxMeasuredValueCtx.drawImage(
          createMeasuredValueImage(
            minMaxIndSize,
            Color$1.RED.medium.getRgbaColor(),
            false,
            vertical
          ),
          0,
          0
        );
      }
    }

    // Create alignment posts in background buffer (backgroundBuffer)
    if (drawBackground2 && backgroundVisible) {
      let valuePos;
      // Create tickmarks in background buffer (backgroundBuffer)
      drawTickmarksImage(backgroundContext, labelNumberFormat, vertical);

      // Draw threshold image to background context
      if (thresholdVisible) {
        backgroundContext.save();
        if (vertical) {
          // Vertical orientation
          valuePos =
            imageHeight * 0.856796 -
            (imageHeight * 0.728155 * (threshold - minValue)) /
              (maxValue - minValue);
          backgroundContext.translate(
            imageWidth * 0.365,
            valuePos - minMaxIndSize / 2
          );
        } else {
          // Horizontal orientation
          valuePos =
            ((imageWidth * 0.856796 - imageWidth * 0.12864) *
              (threshold - minValue)) /
            (maxValue - minValue);
          backgroundContext.translate(
            imageWidth * 0.142857 - minMaxIndSize / 2 + valuePos,
            imageHeight * 0.58
          );
        }
        backgroundContext.drawImage(createThresholdImage(vertical), 0, 0);
        backgroundContext.restore();
      }

      // Create title in background buffer (backgroundBuffer)
      if (vertical) {
        drawTitleImage(
          backgroundContext,
          imageWidth,
          imageHeight,
          titleString,
          unitString,
          backgroundColor,
          vertical,
          null,
          lcdVisible
        );
      } else {
        drawTitleImage(
          backgroundContext,
          imageWidth,
          imageHeight,
          titleString,
          unitString,
          backgroundColor,
          vertical,
          null,
          lcdVisible
        );
      }
    }

    // Create lcd background if selected in background buffer (backgroundBuffer)
    if (drawBackground2 && lcdVisible) {
      if (vertical) {
        lcdBuffer = createLcdBackgroundImage(
          imageWidth * 0.571428,
          imageHeight * 0.055,
          lcdColor
        );
        backgroundContext.drawImage(
          lcdBuffer,
          (imageWidth - imageWidth * 0.571428) / 2,
          imageHeight * 0.88
        );
      } else {
        lcdBuffer = createLcdBackgroundImage(
          imageWidth * 0.18,
          imageHeight * 0.15,
          lcdColor
        );
        backgroundContext.drawImage(
          lcdBuffer,
          imageWidth * 0.695,
          imageHeight * 0.22
        );
      }
    }

    // Draw leds of bargraph
    if (drawBargraphLed) {
      drawInActiveLed(inActiveLedContext);
      drawActiveLed(activeLedContext, valueColor);
    }

    // Convert Section values into pixels
    isSectionsVisible = false;
    if (section !== null && section.length > 0) {
      isSectionsVisible = true;
      let sectionIndex = section.length;
      let top;
      let bottom;
      let fullSize;
      let ledWidth2;

      if (vertical) {
        // Vertical orientation
        top = imageHeight * 0.12864; // position of max value
        bottom = imageHeight * 0.856796; // position of min value
        fullSize = bottom - top;
        ledWidth2 = 0;
      } else {
        // Horizontal orientation
        top = imageWidth * 0.856796; // position of max value
        bottom = imageWidth * 0.12864;
        fullSize = top - bottom;
        ledWidth2 = (imageWidth * 0.012135) / 2;
      }
      sectionPixels = [];
      do {
        sectionIndex--;
        sectionPixels.push({
          start:
            ((section[sectionIndex].start + Math.abs(minValue)) /
              (maxValue - minValue)) *
              fullSize -
            ledWidth2,
          stop:
            ((section[sectionIndex].stop + Math.abs(minValue)) /
              (maxValue - minValue)) *
              fullSize -
            ledWidth2,
          color: customColorDef(section[sectionIndex].color)
        });
      } while (sectionIndex > 0)
    }

    // Use a gradient for the valueColor?
    isGradientVisible = false;
    if (useValueGradient && valueGradient !== null) {
      // force section colors off!
      isSectionsVisible = false;
      isGradientVisible = true;
    }

    // Create foreground in foreground buffer (foregroundBuffer)
    if (drawForeground2 && foregroundVisible) {
      drawLinearForegroundImage(
        foregroundContext,
        imageWidth,
        imageHeight,
        vertical);
    }
  };

  const drawValue = function (ctx, imageWidth, imageHeight) {
    let top; // position of max value
    let bottom; // position of min value
    const labelColor = backgroundColor.labelColor;
    let fullSize;
    let valueBackgroundStartX;
    let valueBackgroundStartY;
    let valueBackgroundStopX;
    let valueBackgroundStopY;
    let valueBorderStartX;
    let valueBorderStartY;
    let valueBorderStopX;
    let valueBorderStopY;
    let currentValue;
    let gradRange;
    let fraction;

    // Orientation dependend definitions
    if (vertical) {
      // Vertical orientation
      top = imageHeight * 0.12864; // position of max value
      bottom = imageHeight * 0.856796; // position of min value
      fullSize = bottom - top;
      valueBackgroundStartX = 0;
      valueBackgroundStartY = top;
      valueBackgroundStopX = 0;
      valueBackgroundStopY = top + fullSize * 1.014;
    } else {
      // Horizontal orientation
      top = imageWidth * 0.856796; // position of max value
      bottom = imageWidth * 0.12864;
      fullSize = top - bottom;
      valueBackgroundStartX = imageWidth * 0.13;
      valueBackgroundStartY = imageHeight * 0.435714;
      valueBackgroundStopX = valueBackgroundStartX + fullSize * 1.035;
      valueBackgroundStopY = valueBackgroundStartY;
    }

    const darker =
      backgroundColor === BackgroundColor.CARBON ||
      backgroundColor === BackgroundColor.PUNCHED_SHEET ||
      backgroundColor === BackgroundColor.STAINLESS ||
      backgroundColor === BackgroundColor.BRUSHED_STAINLESS ||
      backgroundColor === BackgroundColor.TURNED
        ? 0.3
        : 0;

    const valueBackgroundTrackGradient = ctx.createLinearGradient(
      valueBackgroundStartX,
      valueBackgroundStartY,
      valueBackgroundStopX,
      valueBackgroundStopY
    );
    labelColor.setAlpha(0.047058 + darker);
    valueBackgroundTrackGradient.addColorStop(0, labelColor.getRgbaColor());
    labelColor.setAlpha(0.145098 + darker);
    valueBackgroundTrackGradient.addColorStop(0.48, labelColor.getRgbaColor());
    labelColor.setAlpha(0.149019 + darker);
    valueBackgroundTrackGradient.addColorStop(0.49, labelColor.getRgbaColor());
    labelColor.setAlpha(0.047058 + darker);
    valueBackgroundTrackGradient.addColorStop(1, labelColor.getRgbaColor());
    ctx.fillStyle = valueBackgroundTrackGradient;

    if (vertical) {
      ctx.fillRect(
        imageWidth * 0.435714,
        top,
        imageWidth * 0.15,
        fullSize * 1.014
      );
    } else {
      ctx.fillRect(
        valueBackgroundStartX,
        valueBackgroundStartY,
        fullSize * 1.035,
        imageHeight * 0.152857
      );
    }

    if (vertical) {
      // Vertical orientation
      valueBorderStartX = 0;
      valueBorderStartY = top;
      valueBorderStopX = 0;
      valueBorderStopY = top + fullSize * 1.014;
    } else {
      // Horizontal orientation                ;
      valueBorderStartX = valueBackgroundStartX;
      valueBorderStartY = 0;
      valueBorderStopX = valueBackgroundStopX;
      valueBorderStopY = 0;
    }

    const valueBorderGradient = ctx.createLinearGradient(
      valueBorderStartX,
      valueBorderStartY,
      valueBorderStopX,
      valueBorderStopY
    );
    labelColor.setAlpha(0.298039 + darker);
    valueBorderGradient.addColorStop(0, labelColor.getRgbaColor());
    labelColor.setAlpha(0.686274 + darker);
    valueBorderGradient.addColorStop(0.48, labelColor.getRgbaColor());
    labelColor.setAlpha(0.698039 + darker);
    valueBorderGradient.addColorStop(0.49, labelColor.getRgbaColor());
    labelColor.setAlpha(0.4 + darker);
    valueBorderGradient.addColorStop(1, labelColor.getRgbaColor());
    ctx.fillStyle = valueBorderGradient;
    if (vertical) {
      ctx.fillRect(
        imageWidth * 0.435714,
        top,
        imageWidth * 0.007142,
        fullSize * 1.014
      );
      ctx.fillRect(
        imageWidth * 0.571428,
        top,
        imageWidth * 0.007142,
        fullSize * 1.014
      );
    } else {
      ctx.fillRect(
        imageWidth * 0.13,
        imageHeight * 0.435714,
        fullSize * 1.035,
        imageHeight * 0.007142
      );
      ctx.fillRect(
        imageWidth * 0.13,
        imageHeight * 0.571428,
        fullSize * 1.035,
        imageHeight * 0.007142
      );
    }

    // Prepare led specific variables
    let ledX;
    let ledY;
    let ledW;
    let ledH;
    let activeLeds;
    let inactiveLeds;
    if (vertical) {
      // VERTICAL
      ledX = imageWidth * 0.45;
      ledY = imageHeight * 0.851941;
      ledW = imageWidth * 0.121428;
      ledH = imageHeight * 0.012135;
    } else {
      // HORIZONTAL
      ledX = imageWidth * 0.142857;
      ledY = imageHeight * 0.45;
      ledW = imageWidth * 0.012135;
      ledH = imageHeight * 0.121428;
    }

    let translateX;
    let translateY;
    let activeLedColor;
    let lastActiveLedColor = valueColor;
    let i;
    // Draw the value
    if (vertical) {
      // Draw the inactive leds
      inactiveLeds = fullSize;
      for (translateY = 0; translateY <= inactiveLeds; translateY += ledH + 1) {
        ctx.translate(0, -translateY);
        ctx.drawImage(inActiveLedBuffer, ledX, ledY);
        ctx.translate(0, translateY);
      }
      // Draw the active leds in dependence on the current value
      activeLeds = ((value - minValue) / (maxValue - minValue)) * fullSize;
      for (translateY = 0; translateY <= activeLeds; translateY += ledH + 1) {
        // check for LED color
        activeLedColor = valueColor;
        // Use a gradient for value colors?
        if (isGradientVisible) {
          // Convert pixel back to value
          currentValue =
            minValue + (translateY / fullSize) * (maxValue - minValue);
          gradRange = valueGradient.getEnd() - valueGradient.getStart();
          fraction = (currentValue - minValue) / gradRange;
          fraction = Math.max(Math.min(fraction, 1), 0);
          activeLedColor = customColorDef(
            valueGradient.getColorAt(fraction).getRgbaColor()
          );
        } else if (isSectionsVisible) {
          for (i = 0; i < sectionPixels.length; i++) {
            if (
              translateY >= sectionPixels[i].start &&
              translateY < sectionPixels[i].stop
            ) {
              activeLedColor = sectionPixels[i].color;
              break
            }
          }
        }
        // Has LED color changed? If so redraw the buffer
        if (
          lastActiveLedColor.medium.getHexColor() !==
          activeLedColor.medium.getHexColor()
        ) {
          drawActiveLed(activeLedContext, activeLedColor);
          lastActiveLedColor = activeLedColor;
        }
        // Draw LED
        ctx.translate(0, -translateY);
        ctx.drawImage(activeLedBuffer, ledX, ledY);
        ctx.translate(0, translateY);
      }
    } else {
      // Draw the inactive leds
      inactiveLeds = fullSize;
      for (
        translateX = -(ledW / 2);
        translateX <= inactiveLeds;
        translateX += ledW + 1
      ) {
        ctx.translate(translateX, 0);
        ctx.drawImage(inActiveLedBuffer, ledX, ledY);
        ctx.translate(-translateX, 0);
      }
      // Draw the active leds in dependence on the current value
      activeLeds = ((value - minValue) / (maxValue - minValue)) * fullSize;
      for (
        translateX = -(ledW / 2);
        translateX <= activeLeds;
        translateX += ledW + 1
      ) {
        // check for LED color
        activeLedColor = valueColor;
        if (isGradientVisible) {
          // Convert pixel back to value
          currentValue =
            minValue + (translateX / fullSize) * (maxValue - minValue);
          gradRange = valueGradient.getEnd() - valueGradient.getStart();
          fraction = (currentValue - minValue) / gradRange;
          fraction = Math.max(Math.min(fraction, 1), 0);
          activeLedColor = customColorDef(
            valueGradient.getColorAt(fraction).getRgbaColor()
          );
        } else if (isSectionsVisible) {
          for (i = 0; i < sectionPixels.length; i++) {
            if (
              translateX >= sectionPixels[i].start &&
              translateX < sectionPixels[i].stop
            ) {
              activeLedColor = sectionPixels[i].color;
              break
            }
          }
        }
        // Has LED color changed? If so redraw the buffer
        if (
          lastActiveLedColor.medium.getHexColor() !==
          activeLedColor.medium.getHexColor()
        ) {
          drawActiveLed(activeLedContext, activeLedColor);
          lastActiveLedColor = activeLedColor;
        }
        ctx.translate(translateX, 0);
        ctx.drawImage(activeLedBuffer, ledX, ledY);
        ctx.translate(-translateX, 0);
      }
    }
  };

  const drawInActiveLed = function (ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.closePath();
    const ledCenterX = ctx.canvas.width / 2;
    const ledCenterY = ctx.canvas.height / 2;
    const ledGradient = mainCtx.createRadialGradient(
      ledCenterX,
      ledCenterY,
      0,
      ledCenterX,
      ledCenterY,
      ctx.canvas.width / 2
    );
    ledGradient.addColorStop(0, '#3c3c3c');
    ledGradient.addColorStop(1, '#323232');
    ctx.fillStyle = ledGradient;
    ctx.fill();
    ctx.restore();
  };

  const drawActiveLed = function (ctx, color) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.closePath();
    const ledCenterX = ctx.canvas.width / 2;
    const ledCenterY = ctx.canvas.height / 2;
    let outerRadius;
    if (vertical) {
      outerRadius = ctx.canvas.width / 2;
    } else {
      outerRadius = ctx.canvas.height / 2;
    }
    const ledGradient = mainCtx.createRadialGradient(
      ledCenterX,
      ledCenterY,
      0,
      ledCenterX,
      ledCenterY,
      outerRadius
    );
    ledGradient.addColorStop(0, color.light.getRgbaColor());
    ledGradient.addColorStop(1, color.dark.getRgbaColor());
    ctx.fillStyle = ledGradient;
    ctx.fill();
    ctx.restore();
  };

  const repaint = function () {
    if (!initialized) {
      init({
        frame: true,
        background: true,
        led: true,
        pointer: true,
        foreground: true,
        bargraphled: true
      });
    }

    // mainCtx.save();
    mainCtx.clearRect(0, 0, mainCtx.canvas.width, mainCtx.canvas.height);

    // Draw frame
    if (frameVisible) {
      mainCtx.drawImage(frameBuffer, 0, 0);
    }

    // Draw buffered image to visible canvas
    if (backgroundVisible) {
      mainCtx.drawImage(backgroundBuffer, 0, 0);
    }

    // Draw lcd display
    if (lcdVisible) {
      drawLcdText(mainCtx, value, vertical);
    }

    // Draw led
    if (ledVisible) {
      mainCtx.drawImage(ledBuffer, ledPosX, ledPosY);
    }
    let valuePos;
    let minMaxX;
    let minMaxY;
    // Draw min measured value indicator
    if (minMeasuredValueVisible) {
      if (vertical) {
        valuePos =
          imageHeight * 0.856796 -
          (imageHeight * 0.728155 * (minMeasuredValue - minValue)) /
            (maxValue - minValue);
        minMaxX = imageWidth * 0.34 - minMeasuredValueBuffer.width;
        minMaxY = valuePos - minMeasuredValueBuffer.height / 2;
      } else {
        valuePos =
          ((imageWidth * 0.856796 - imageWidth * 0.12864) *
            (minMeasuredValue - minValue)) /
          (maxValue - minValue);
        minMaxX =
          imageWidth * 0.142857 - minMeasuredValueBuffer.height / 2 + valuePos;
        minMaxY = imageHeight * 0.65;
      }
      mainCtx.drawImage(minMeasuredValueBuffer, minMaxX, minMaxY);
    }

    // Draw max measured value indicator
    if (maxMeasuredValueVisible) {
      if (vertical) {
        valuePos =
          imageHeight * 0.856796 -
          (imageHeight * 0.728155 * (maxMeasuredValue - minValue)) /
            (maxValue - minValue);
        minMaxX = imageWidth * 0.34 - maxMeasuredValueBuffer.width;
        minMaxY = valuePos - maxMeasuredValueBuffer.height / 2;
      } else {
        valuePos =
          ((imageWidth * 0.856796 - imageWidth * 0.12864) *
            (maxMeasuredValue - minValue)) /
          (maxValue - minValue);
        minMaxX =
          imageWidth * 0.142857 - maxMeasuredValueBuffer.height / 2 + valuePos;
        minMaxY = imageHeight * 0.65;
      }
      mainCtx.drawImage(maxMeasuredValueBuffer, minMaxX, minMaxY);
    }

    mainCtx.save();
    drawValue(mainCtx, imageWidth, imageHeight);
    mainCtx.restore();

    // Draw foreground
    if (foregroundVisible) {
      mainCtx.drawImage(foregroundBuffer, 0, 0);
    }
  };

  // Visualize the component
  repaint();
}

class LinearBargraphElement extends BaseElement {
  static get drawFunction () { return drawLinearBargraph }

  static get properties () {
    return {
      width: { type: Number, defaultValue: 125 },
      height: { type: Number, defaultValue: 200 },
      value: { type: Number, defaultValue: 0 },
      real_value: { state: true },
      transitionTime: { type: Number, defaultValue: 500 },
      minValue: { type: Number, defaultValue: 0 },
      maxValue: { type: Number, defaultValue: 100 },
      threshold: { type: Number, defaultValue: 50 },
      noNiceScale: { type: Boolean, defaultValue: false },
      titleString: { type: String, defaultValue: '' },
      unitString: { type: String, defaultValue: '' },
      frameDesign: { type: String, objectEnum: FrameDesign, defaultValue: 'METAL' },
      noFrameVisible: { type: Boolean, defaultValue: false },
      backgroundColor: { type: String, objectEnum: BackgroundColor, defaultValue: 'DARK_GRAY' },
      noBackgroundVisible: { type: Boolean, defaultValue: false },
      valueColor: { type: String, objectEnum: Color$1, defaultValue: 'RED' },
      lcdColor: { type: String, objectEnum: LcdColor, defaultValue: 'STANDARD' },
      noLcdVisible: { type: Boolean, defaultValue: false },
      lcdDecimals: { type: Number, defaultValue: 2 },
      digitalFont: { type: Boolean, defaultValue: false },
      thresholdVisible: { type: Boolean, defaultValue: false },
      minMeasuredValueVisible: { type: Boolean, defaultValue: false },
      maxMeasuredValueVisible: { type: Boolean, defaultValue: false },
      labelNumberFormat: { type: String, objectEnum: LabelNumberFormat, defaultValue: 'STANDARD' },
      noForegroundVisible: { type: Boolean, defaultValue: false }
    }
  }

  constructor () {
    super();
    this._timer = timer(() => {});
    this._timer.stop();
  }

  connectedCallback () {
    super.connectedCallback();
    this.real_value = this.real_value ?? this.minValue;
  }

  render () {
    return $`
      <canvas width="${this.width}" height="${this.height}"></canvas>
    `
  }

  updated (changedProperties) {
    super.updated();
    if (changedProperties.has('value') || changedProperties.has('transitionTime')) {
      const transitionTime = this.transitionTime;
      const originTime = now();
      const originValue = this.real_value;
      const targetValue = this.value;
      const timeScale = transitionTime <= 0 ? () => 1 : linear().domain([0, transitionTime]).clamp(true);
      const valueScale = linear().range([originValue, targetValue]).clamp(true);
      this._timer.restart((elapsedTime) => {
        const scaled = timeScale(elapsedTime);
        const eased = cubicInOut(scaled);
        const newValue = valueScale(eased);
        this.real_value = newValue;
        if (now() >= originTime + transitionTime) {
          this._timer.stop();
        }
      });
    }
  }
}

window.customElements.define('steelseries-linear-bargraph', LinearBargraphElement);

function drawDisplaySingle (canvas, parameters) {
  parameters = parameters || {};
  let width = undefined === parameters.width ? 0 : parameters.width;
  let height = undefined === parameters.height ? 0 : parameters.height;
  const lcdColor =
    undefined === parameters.lcdColor ? LcdColor.STANDARD : parameters.lcdColor;
  const lcdDecimals =
    undefined === parameters.lcdDecimals ? 2 : parameters.lcdDecimals;
  const unitString =
    undefined === parameters.unitString ? '' : parameters.unitString;
  const unitStringVisible =
    undefined === parameters.unitStringVisible
      ? false
      : parameters.unitStringVisible;
  const headerString =
    undefined === parameters.headerString ? '' : parameters.headerString;
  const headerStringVisible =
    undefined === parameters.headerStringVisible
      ? false
      : parameters.headerStringVisible;
  const digitalFont =
    undefined === parameters.digitalFont ? false : parameters.digitalFont;
  const valuesNumeric =
    undefined === parameters.valuesNumeric ? true : parameters.valuesNumeric;
  let value = undefined === parameters.value ? 0 : parameters.value;
  const section = undefined === parameters.section ? null : parameters.section;

  value = valuesNumeric ? parseFloat(value) : value;

  // Get the canvas context and clear it
  const mainCtx = getCanvasContext(canvas);
  // Has a size been specified?
  if (width === 0) {
    width = mainCtx.canvas.width;
  }
  if (height === 0) {
    height = mainCtx.canvas.height;
  }

  // Set the size - also clears the canvas
  mainCtx.canvas.width = width;
  mainCtx.canvas.height = height;

  const imageWidth = width;
  const imageHeight = height;

  const fontHeight = Math.floor(imageHeight / 1.5);
  const stdFont = fontHeight + 'px ' + stdFontName;
  const lcdFont = fontHeight + 'px ' + lcdFontName;

  let initialized = false;

  // **************   Buffer creation  ********************
  // Buffer for the lcd
  let lcdBuffer;
  const sectionBuffer = [];
  const sectionForegroundColor = [];

  // **************   Image creation  ********************
  const drawLcdText = function (value, color) {
    mainCtx.save();
    mainCtx.textAlign = 'right';
    // mainCtx.textBaseline = 'top';
    mainCtx.strokeStyle = color;
    mainCtx.fillStyle = color;

    mainCtx.beginPath();
    mainCtx.rect(2, 0, imageWidth - 4, imageHeight);
    mainCtx.closePath();
    mainCtx.clip();

    if (
      (lcdColor === LcdColor.STANDARD ||
        lcdColor === LcdColor.STANDARD_GREEN) &&
      section === null
    ) {
      mainCtx.shadowColor = 'gray';
      mainCtx.shadowOffsetX = imageHeight * 0.035;
      mainCtx.shadowOffsetY = imageHeight * 0.035;
      mainCtx.shadowBlur = imageHeight * 0.055;
    }

    mainCtx.font = digitalFont ? lcdFont : stdFont;

    if (valuesNumeric) {
      // Numeric value
      let unitWidth = 0;
      if (unitStringVisible) {
        mainCtx.font = Math.floor(imageHeight / 2.5) + 'px ' + stdFontName;
        unitWidth = mainCtx.measureText(unitString).width;
      }
      mainCtx.font = digitalFont ? lcdFont : stdFont;
      const lcdText = value.toFixed(lcdDecimals);
      let vPos = 0.38;
      if (headerStringVisible) {
        vPos = 0.52;
      }

      mainCtx.fillText(
        lcdText,
        imageWidth - unitWidth - 4,
        imageHeight * 0.5 + fontHeight * vPos
      );

      if (unitStringVisible) {
        mainCtx.font = Math.floor(imageHeight / 2.5) + 'px ' + stdFontName;
        mainCtx.fillText(
          unitString,
          imageWidth - 2,
          imageHeight * 0.5 + fontHeight * vPos
        );
      }
      if (headerStringVisible) {
        mainCtx.textAlign = 'center';
        mainCtx.font = Math.floor(imageHeight / 3.5) + 'px ' + stdFontName;
        mainCtx.fillText(headerString, imageWidth / 2, imageHeight * 0.3);
      }
    } else {
      // Text value
      mainCtx.fillText(
        value,
        imageWidth - 2,
        imageHeight * 0.5 + fontHeight * 0.38
      );
    }
    mainCtx.restore();
  };

  const createLcdSectionImage = function (width, height, color, lcdColor) {
    const lcdSectionBuffer = createBuffer(width, height);
    const lcdCtx = lcdSectionBuffer.getContext('2d');

    lcdCtx.save();
    const xB = 0;
    const yB = 0;
    const wB = width;
    const hB = height;
    const rB = Math.min(width, height) * 0.095;

    const lcdBackground = lcdCtx.createLinearGradient(0, yB, 0, yB + hB);

    lcdBackground.addColorStop(0, '#4c4c4c');
    lcdBackground.addColorStop(0.08, '#666666');
    lcdBackground.addColorStop(0.92, '#666666');
    lcdBackground.addColorStop(1, '#e6e6e6');
    lcdCtx.fillStyle = lcdBackground;

    roundedRectangle(lcdCtx, xB, yB, wB, hB, rB);

    lcdCtx.fill();
    lcdCtx.restore();

    lcdCtx.save();

    const rgb = getColorValues(color);
    const hsb = rgbToHsb(rgb[0], rgb[1], rgb[2]);

    const rgbStart = getColorValues(lcdColor.gradientStartColor);
    const hsbStart = rgbToHsb(rgbStart[0], rgbStart[1], rgbStart[2]);
    const rgbFraction1 = getColorValues(lcdColor.gradientFraction1Color);
    const hsbFraction1 = rgbToHsb(
      rgbFraction1[0],
      rgbFraction1[1],
      rgbFraction1[2]
    );
    const rgbFraction2 = getColorValues(lcdColor.gradientFraction2Color);
    const hsbFraction2 = rgbToHsb(
      rgbFraction2[0],
      rgbFraction2[1],
      rgbFraction2[2]
    );
    const rgbFraction3 = getColorValues(lcdColor.gradientFraction3Color);
    const hsbFraction3 = rgbToHsb(
      rgbFraction3[0],
      rgbFraction3[1],
      rgbFraction3[2]
    );
    const rgbStop = getColorValues(lcdColor.gradientStopColor);
    const hsbStop = rgbToHsb(rgbStop[0], rgbStop[1], rgbStop[2]);

    const startColor = hsbToRgb(hsb[0], hsb[1], hsbStart[2] - 0.31);
    const fraction1Color = hsbToRgb(hsb[0], hsb[1], hsbFraction1[2] - 0.31);
    const fraction2Color = hsbToRgb(hsb[0], hsb[1], hsbFraction2[2] - 0.31);
    const fraction3Color = hsbToRgb(hsb[0], hsb[1], hsbFraction3[2] - 0.31);
    const stopColor = hsbToRgb(hsb[0], hsb[1], hsbStop[2] - 0.31);

    const xF = 1;
    const yF = 1;
    const wF = width - 2;
    const hF = height - 2;
    const rF = rB - 1;
    const lcdForeground = lcdCtx.createLinearGradient(0, yF, 0, yF + hF);
    lcdForeground.addColorStop(
      0,
      'rgb(' + startColor[0] + ', ' + startColor[1] + ', ' + startColor[2] + ')'
    );
    lcdForeground.addColorStop(
      0.03,
      'rgb(' +
        fraction1Color[0] +
        ',' +
        fraction1Color[1] +
        ',' +
        fraction1Color[2] +
        ')'
    );
    lcdForeground.addColorStop(
      0.49,
      'rgb(' +
        fraction2Color[0] +
        ',' +
        fraction2Color[1] +
        ',' +
        fraction2Color[2] +
        ')'
    );
    lcdForeground.addColorStop(
      0.5,
      'rgb(' +
        fraction3Color[0] +
        ',' +
        fraction3Color[1] +
        ',' +
        fraction3Color[2] +
        ')'
    );
    lcdForeground.addColorStop(
      1,
      'rgb(' + stopColor[0] + ',' + stopColor[1] + ',' + stopColor[2] + ')'
    );
    lcdCtx.fillStyle = lcdForeground;

    roundedRectangle(lcdCtx, xF, yF, wF, hF, rF);

    lcdCtx.fill();
    lcdCtx.restore();

    return lcdSectionBuffer
  };

  const createSectionForegroundColor = function (sectionColor) {
    const rgbSection = getColorValues(sectionColor);
    const hsbSection = rgbToHsb(rgbSection[0], rgbSection[1], rgbSection[2]);
    const sectionForegroundRgb = hsbToRgb(hsbSection[0], 0.57, 0.83);
    return (
      'rgb(' +
      sectionForegroundRgb[0] +
      ', ' +
      sectionForegroundRgb[1] +
      ', ' +
      sectionForegroundRgb[2] +
      ')'
    )
  };

  // **************   Initialization  ********************
  const init = function () {
    let sectionIndex;
    initialized = true;

    // Create lcd background if selected in background buffer (backgroundBuffer)
    lcdBuffer = createLcdBackgroundImage(width, height, lcdColor);

    if (section !== null && section.length > 0) {
      for (sectionIndex = 0; sectionIndex < section.length; sectionIndex++) {
        sectionBuffer[sectionIndex] = createLcdSectionImage(
          width,
          height,
          section[sectionIndex].color,
          lcdColor
        );
        sectionForegroundColor[sectionIndex] = createSectionForegroundColor(
          section[sectionIndex].color
        );
      }
    }
  };

  const repaint = function () {
    if (!initialized) {
      init();
    }

    // mainCtx.save();
    mainCtx.clearRect(0, 0, mainCtx.canvas.width, mainCtx.canvas.height);

    let lcdBackgroundBuffer = lcdBuffer;
    let lcdTextColor = lcdColor.textColor;
    let sectionIndex;
    // Draw sections
    if (section !== null && section.length > 0) {
      for (sectionIndex = 0; sectionIndex < section.length; sectionIndex++) {
        if (
          value >= section[sectionIndex].start &&
          value <= section[sectionIndex].stop
        ) {
          lcdBackgroundBuffer = sectionBuffer[sectionIndex];
          lcdTextColor = sectionForegroundColor[sectionIndex];
          break
        }
      }
    }

    // Draw lcd background
    mainCtx.drawImage(lcdBackgroundBuffer, 0, 0);

    // Draw lcd text
    drawLcdText(value, lcdTextColor);
  };

  // Visualize the component
  repaint();
}

class DisplaySingleElement extends BaseElement {
  static get drawFunction () { return drawDisplaySingle }

  static get properties () {
    return {
      width: { type: Number, defaultValue: 200 },
      height: { type: Number, defaultValue: 80 },
      value: { type: String, defaultValue: '' },
      valuesNumeric: { type: Boolean, defaultValue: false },
      lcdDecimals: { type: Number, defaultValue: 2 },
      lcdColor: { type: String, objectEnum: LcdColor, defaultValue: 'STANDARD' },
      headerString: { type: String, defaultValue: '' },
      headerStringVisible: { type: Boolean, defaultValue: false },
      noLinkAltValue: { type: Boolean, defaultValue: false },
      unitString: { type: String, defaultValue: '' },
      unitStringVisible: { type: Boolean, defaultValue: false },
      digitalFont: { type: Boolean, defaultValue: false }
    }
  }

  render () {
    return $`
      <canvas width="${this.width}" height="${this.height}"></canvas>
    `
  }
}

window.customElements.define('steelseries-display-single', DisplaySingleElement);

function drawDisplayMulti (canvas, parameters) {
  parameters = parameters || {};
  let width = undefined === parameters.width ? 0 : parameters.width;
  let height = undefined === parameters.height ? 0 : parameters.height;
  const lcdColor =
    undefined === parameters.lcdColor ? LcdColor.STANDARD : parameters.lcdColor;
  const lcdDecimals =
    undefined === parameters.lcdDecimals ? 2 : parameters.lcdDecimals;
  const headerString =
    undefined === parameters.headerString ? '' : parameters.headerString;
  const headerStringVisible =
    undefined === parameters.headerStringVisible
      ? false
      : parameters.headerStringVisible;
  const detailString =
    undefined === parameters.detailString ? '' : parameters.detailString;
  const detailStringVisible =
    undefined === parameters.detailStringVisible
      ? false
      : parameters.detailStringVisible;
  const unitString =
    undefined === parameters.unitString ? '' : parameters.unitString;
  const unitStringVisible =
    undefined === parameters.unitStringVisible
      ? false
      : parameters.unitStringVisible;
  const digitalFont =
    undefined === parameters.digitalFont ? false : parameters.digitalFont;
  const valuesNumeric =
    undefined === parameters.valuesNumeric ? true : parameters.valuesNumeric;
  let value = undefined === parameters.value ? 0 : parameters.value;
  let altValue = undefined === parameters.altValue ? 0 : parameters.altValue;

  value = valuesNumeric ? parseFloat(value) : value;
  altValue = valuesNumeric ? parseFloat(altValue) : altValue;

  // Get the canvas context and clear it
  const mainCtx = getCanvasContext(canvas);
  // Has a size been specified?
  if (width === 0) {
    width = mainCtx.canvas.width;
  }
  if (height === 0) {
    height = mainCtx.canvas.height;
  }

  // Set the size - also clears the canvas
  mainCtx.canvas.width = width;
  mainCtx.canvas.height = height;

  const imageWidth = width;
  const imageHeight = height;

  const stdFont = Math.floor(imageHeight / 1.875) + 'px ' + stdFontName;
  const lcdFont = Math.floor(imageHeight / 1.875) + 'px ' + lcdFontName;
  const stdAltFont = Math.floor(imageHeight / 3.5) + 'px ' + stdFontName;
  const lcdAltFont = Math.floor(imageHeight / 3.5) + 'px ' + lcdFontName;

  let initialized = false;

  // **************   Buffer creation  ********************
  // Buffer for the lcd
  let lcdBuffer;

  // **************   Image creation  ********************
  const drawLcdText = function (value) {
    mainCtx.save();
    mainCtx.textAlign = 'right';
    mainCtx.textBaseline = 'middle';
    mainCtx.strokeStyle = lcdColor.textColor;
    mainCtx.fillStyle = lcdColor.textColor;

    if (
      lcdColor === LcdColor.STANDARD ||
      lcdColor === LcdColor.STANDARD_GREEN
    ) {
      mainCtx.shadowColor = 'gray';
      mainCtx.shadowOffsetX = imageHeight * 0.025;
      mainCtx.shadowOffsetY = imageHeight * 0.025;
      mainCtx.shadowBlur = imageHeight * 0.05;
    }

    if (valuesNumeric) {
      // Numeric value
      if (headerStringVisible) {
        mainCtx.font = Math.floor(imageHeight / 3) + 'px ' + stdFontName;
      } else {
        mainCtx.font = Math.floor(imageHeight / 2.5) + 'px ' + stdFontName;
      }
      let unitWidth = 0;
      if (unitStringVisible) {
        if (headerStringVisible) {
          mainCtx.font = Math.floor(imageHeight / 3) + 'px ' + stdFontName;
          unitWidth = mainCtx.measureText(unitString).width;
        } else {
          mainCtx.font = Math.floor(imageHeight / 2.5) + 'px ' + stdFontName;
          unitWidth = mainCtx.measureText(unitString).width;
        }
      }
      mainCtx.font = digitalFont ? lcdFont : stdFont;
      const valueText = value.toFixed(lcdDecimals);
      if (headerStringVisible) {
        mainCtx.fillText(
          valueText,
          imageWidth - unitWidth - 4,
          imageHeight * 0.5
        );
      } else {
        mainCtx.fillText(
          valueText,
          imageWidth - unitWidth - 4,
          imageHeight * 0.38
        );
      }

      if (unitStringVisible) {
        mainCtx.font = Math.floor(imageHeight / 3) + 'px ' + stdFontName;
        mainCtx.fillText(unitString, imageWidth - 2, imageHeight * 0.55);
      }

      let altValueText = altValue.toFixed(lcdDecimals);
      if (detailStringVisible) {
        altValueText = detailString + altValueText;
      }
      if (digitalFont) {
        mainCtx.font = lcdAltFont;
      } else {
        if (headerStringVisible) {
          mainCtx.font = Math.floor(imageHeight / 5) + 'px ' + stdFontName;
        } else {
          mainCtx.font = stdAltFont;
        }
      }
      mainCtx.textAlign = 'center';
      if (headerStringVisible) {
        mainCtx.fillText(altValueText, imageWidth / 2, imageHeight * 0.83);
        mainCtx.fillText(headerString, imageWidth / 2, imageHeight * 0.16);
      } else {
        mainCtx.fillText(altValueText, imageWidth / 2, imageHeight * 0.8);
      }
    } else {
      if (headerStringVisible) {
        // Text value
        mainCtx.font = Math.floor(imageHeight / 3.5) + 'px ' + stdFontName;
        mainCtx.fillText(value, imageWidth - 2, imageHeight * 0.48);

        // mainCtx.font = stdAltFont;
        mainCtx.font = Math.floor(imageHeight / 5) + 'px ' + stdFontName;
        mainCtx.textAlign = 'center';
        mainCtx.fillText(altValue, imageWidth / 2, imageHeight * 0.83);
        mainCtx.fillText(headerString, imageWidth / 2, imageHeight * 0.17);
      } else {
        // Text value
        mainCtx.font = Math.floor(imageHeight / 2.5) + 'px ' + stdFontName;
        mainCtx.fillText(value, imageWidth - 2, imageHeight * 0.38);

        mainCtx.font = stdAltFont;
        mainCtx.textAlign = 'center';
        mainCtx.fillText(altValue, imageWidth / 2, imageHeight * 0.8);
      }
    }
    mainCtx.restore();
  };

  // **************   Initialization  ********************
  const init = function () {
    initialized = true;

    // Create lcd background if selected in background buffer (backgroundBuffer)
    lcdBuffer = createLcdBackgroundImage(width, height, lcdColor);
  };

  const repaint = function () {
    if (!initialized) {
      init();
    }

    // mainCtx.save();
    mainCtx.clearRect(0, 0, mainCtx.canvas.width, mainCtx.canvas.height);

    // Draw lcd background
    mainCtx.drawImage(lcdBuffer, 0, 0);

    // Draw lcd text
    drawLcdText(value);
  };

  // Visualize the component
  repaint();
}

class DisplayMultiElement extends BaseElement {
  static get drawFunction () { return drawDisplayMulti }

  static get properties () {
    return {
      width: { type: Number, defaultValue: 200 },
      height: { type: Number, defaultValue: 80 },
      value: { type: String, defaultValue: '' },
      altValue: { type: String, defaultValue: '' },
      valuesNumeric: { type: Boolean, defaultValue: false },
      lcdDecimals: { type: Number, defaultValue: 2 },
      lcdColor: { type: String, objectEnum: LcdColor, defaultValue: 'STANDARD' },
      headerString: { type: String, defaultValue: '' },
      headerStringVisible: { type: Boolean, defaultValue: false },
      detailString: { type: String, defaultValue: '' },
      detailStringVisible: { type: Boolean, defaultValue: false },
      unitString: { type: String, defaultValue: '' },
      unitStringVisible: { type: Boolean, defaultValue: false },
      digitalFont: { type: Boolean, defaultValue: false }
    }
  }

  render () {
    return $`
      <canvas width="${this.width}" height="${this.height}"></canvas>
    `
  }
}

window.customElements.define('steelseries-display-multi', DisplayMultiElement);

function drawLevel (canvas, parameters) {
  parameters = parameters || {};
  let size = undefined === parameters.size ? 0 : parameters.size;
  const decimalsVisible =
    undefined === parameters.decimalsVisible
      ? false
      : parameters.decimalsVisible;
  const textOrientationFixed =
    undefined === parameters.textOrientationFixed
      ? false
      : parameters.textOrientationFixed;
  const frameDesign =
    undefined === parameters.frameDesign
      ? FrameDesign.METAL
      : parameters.frameDesign;
  const frameVisible =
    undefined === parameters.frameVisible ? true : parameters.frameVisible;
  const backgroundColor =
    undefined === parameters.backgroundColor
      ? BackgroundColor.DARK_GRAY
      : parameters.backgroundColor;
  const backgroundVisible =
    undefined === parameters.backgroundVisible
      ? true
      : parameters.backgroundVisible;
  const pointerColor =
    undefined === parameters.pointerColor
      ? Color$1.RED
      : parameters.pointerColor;
  const foregroundType =
    undefined === parameters.foregroundType
      ? ForegroundType.TYPE1
      : parameters.foregroundType;
  const foregroundVisible =
    undefined === parameters.foregroundVisible
      ? true
      : parameters.foregroundVisible;
  const rotateFace =
    undefined === parameters.rotateFace ? false : parameters.rotateFace;

  // Get the canvas context and clear it
  const mainCtx = getCanvasContext(canvas);
  // Has a size been specified?
  if (size === 0) {
    size = Math.min(mainCtx.canvas.width, mainCtx.canvas.height);
  }

  // Set the size - also clears the canvas
  mainCtx.canvas.width = size;
  mainCtx.canvas.height = size;

  const value = parameters.value ?? 0;
  const stepValue = 0;
  const visibleValue = value;
  const angleStep = TWO_PI / 360;
  let angle;
  const decimals = decimalsVisible ? 1 : 0;

  const imageWidth = size;
  const imageHeight = size;

  const centerX = imageWidth / 2;
  const centerY = imageHeight / 2;

  let initialized = false;

  // **************   Buffer creation  ********************
  // Buffer for all static background painting code
  const backgroundBuffer = createBuffer(size, size);
  const backgroundContext = backgroundBuffer.getContext('2d');

  // Buffer for pointer image painting code
  const pointerBuffer = createBuffer(size, size);
  const pointerContext = pointerBuffer.getContext('2d');

  // Buffer for step pointer image painting code
  const stepPointerBuffer = createBuffer(size, size);
  const stepPointerContext = stepPointerBuffer.getContext('2d');

  // Buffer for static foreground painting code
  const foregroundBuffer = createBuffer(size, size);
  const foregroundContext = foregroundBuffer.getContext('2d');

  // **************   Image creation  ********************
  const drawTickmarksImage = function (ctx) {
    let stdFont;
    let smlFont;
    let i;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.save();
    ctx.strokeStyle = backgroundColor.labelColor.getRgbaColor();
    ctx.fillStyle = backgroundColor.labelColor.getRgbaColor();
    ctx.translate(centerX, centerY);

    for (i = 0; i < 360; i++) {
      ctx.strokeStyle = backgroundColor.labelColor.getRgbaColor();
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(imageWidth * 0.38, 0);
      ctx.lineTo(imageWidth * 0.37, 0);
      ctx.closePath();
      ctx.stroke();

      if (i % 5 === 0) {
        ctx.strokeStyle = backgroundColor.labelColor.getRgbaColor();
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(imageWidth * 0.38, 0);
        ctx.lineTo(imageWidth * 0.36, 0);
        ctx.closePath();
        ctx.stroke();
      }

      if (i % 45 === 0) {
        ctx.strokeStyle = backgroundColor.labelColor.getRgbaColor();
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(imageWidth * 0.38, 0);
        ctx.lineTo(imageWidth * 0.34, 0);
        ctx.closePath();
        ctx.stroke();
      }

      // Draw the labels
      if (imageWidth > 300) {
        stdFont = '14px ' + stdFont;
        smlFont = '12px ' + stdFont;
      }
      if (imageWidth <= 300) {
        stdFont = '12px ' + stdFont;
        smlFont = '10px ' + stdFont;
      }
      if (imageWidth <= 200) {
        stdFont = '10px ' + stdFont;
        smlFont = '8px ' + stdFont;
      }
      if (imageWidth <= 100) {
        stdFont = '8px ' + stdFont;
        smlFont = '6px ' + stdFont;
      }
      ctx.save();
      switch (i) {
        case 0:
          ctx.translate(imageWidth * 0.31, 0);
          ctx.rotate(i * RAD_FACTOR + HALF_PI);
          ctx.font = stdFont;
          ctx.fillText('0\u00B0', 0, 0, imageWidth);
          ctx.rotate(-(i * RAD_FACTOR) + HALF_PI);
          ctx.translate(-imageWidth * 0.31, 0);

          ctx.translate(imageWidth * 0.41, 0);
          ctx.rotate(i * RAD_FACTOR - HALF_PI);
          ctx.font = smlFont;
          ctx.fillText('0%', 0, 0, imageWidth);
          break
        case 45:
          ctx.translate(imageWidth * 0.31, 0);
          ctx.rotate(i * RAD_FACTOR + 0.25 * PI);
          ctx.font = stdFont;
          ctx.fillText('45\u00B0', 0, 0, imageWidth);
          ctx.rotate(-(i * RAD_FACTOR) + 0.25 * PI);
          ctx.translate(-imageWidth * 0.31, 0);

          ctx.translate(imageWidth * 0.31, imageWidth * 0.085);
          ctx.rotate(i * RAD_FACTOR - 0.25 * PI);
          ctx.font = smlFont;
          ctx.fillText('100%', 0, 0, imageWidth);
          break
        case 90:
          ctx.translate(imageWidth * 0.31, 0);
          ctx.rotate(i * RAD_FACTOR);
          ctx.font = stdFont;
          ctx.fillText('90\u00B0', 0, 0, imageWidth);
          ctx.rotate(-(i * RAD_FACTOR));
          ctx.translate(-imageWidth * 0.31, 0);

          ctx.translate(imageWidth * 0.21, 0);
          ctx.rotate(i * RAD_FACTOR);
          ctx.font = smlFont;
          ctx.fillText('\u221E', 0, 0, imageWidth);
          break
        case 135:
          ctx.translate(imageWidth * 0.31, 0);
          ctx.rotate(i * RAD_FACTOR - 0.25 * PI);
          ctx.font = stdFont;
          ctx.fillText('45\u00B0', 0, 0, imageWidth);
          ctx.rotate(-(i * RAD_FACTOR) - 0.25 * PI);
          ctx.translate(-imageWidth * 0.31, 0);

          ctx.translate(imageWidth * 0.31, -imageWidth * 0.085);
          ctx.rotate(i * RAD_FACTOR + 0.25 * PI);
          ctx.font = smlFont;
          ctx.fillText('100%', 0, 0, imageWidth);
          break
        case 180:
          ctx.translate(imageWidth * 0.31, 0);
          ctx.rotate(i * RAD_FACTOR - HALF_PI);
          ctx.font = stdFont;
          ctx.fillText('0\u00B0', 0, 0, imageWidth);
          ctx.rotate(-(i * RAD_FACTOR) - HALF_PI);
          ctx.translate(-imageWidth * 0.31, 0);

          ctx.translate(imageWidth * 0.41, 0);
          ctx.rotate(i * RAD_FACTOR + HALF_PI);
          ctx.font = smlFont;
          ctx.fillText('0%', 0, 0, imageWidth);
          ctx.translate(-imageWidth * 0.41, 0);
          break
        case 225:
          ctx.translate(imageWidth * 0.31, 0);
          ctx.rotate(i * RAD_FACTOR - 0.75 * PI);
          ctx.font = stdFont;
          ctx.fillText('45\u00B0', 0, 0, imageWidth);
          ctx.rotate(-(i * RAD_FACTOR) - 0.75 * PI);
          ctx.translate(-imageWidth * 0.31, 0);

          ctx.translate(imageWidth * 0.31, imageWidth * 0.085);
          ctx.rotate(i * RAD_FACTOR + 0.75 * PI);
          ctx.font = smlFont;
          ctx.fillText('100%', 0, 0, imageWidth);
          break
        case 270:
          ctx.translate(imageWidth * 0.31, 0);
          ctx.rotate(i * RAD_FACTOR - PI);
          ctx.font = stdFont;
          ctx.fillText('90\u00B0', 0, 0, imageWidth);
          ctx.rotate(-(i * RAD_FACTOR) - PI);
          ctx.translate(-imageWidth * 0.31, 0);

          ctx.translate(imageWidth * 0.21, 0);
          ctx.rotate(i * RAD_FACTOR - PI);
          ctx.font = smlFont;
          ctx.fillText('\u221E', 0, 0, imageWidth);
          break
        case 315:
          ctx.translate(imageWidth * 0.31, 0);
          ctx.rotate(i * RAD_FACTOR - 1.25 * PI);
          ctx.font = stdFont;
          ctx.fillText('45\u00B0', 0, 0, imageWidth);
          ctx.rotate(-(i * RAD_FACTOR) - 1.25 * PI);
          ctx.translate(-imageWidth * 0.31, 0);

          ctx.translate(imageWidth * 0.31, -imageWidth * 0.085);
          ctx.rotate(i * RAD_FACTOR + 1.25 * PI);
          ctx.font = smlFont;
          ctx.fillText('100%', 0, 0, imageWidth);
          break
      }
      ctx.restore();

      ctx.rotate(angleStep);
    }
    ctx.translate(-centerX, -centerY);
    ctx.restore();
  };

  const drawMarkerImage = function (ctx) {
    ctx.save();

    ctx.strokeStyle = backgroundColor.labelColor.getRgbaColor();
    ctx.fillStyle = backgroundColor.labelColor.getRgbaColor();

    // FRAMELEFT
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(imageWidth * 0.200934, imageHeight * 0.434579);
    ctx.lineTo(imageWidth * 0.163551, imageHeight * 0.434579);
    ctx.lineTo(imageWidth * 0.163551, imageHeight * 0.560747);
    ctx.lineTo(imageWidth * 0.200934, imageHeight * 0.560747);
    ctx.lineWidth = 1;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';
    ctx.stroke();

    // TRIANGLELEFT
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(imageWidth * 0.163551, imageHeight * 0.471962);
    ctx.lineTo(imageWidth * 0.205607, imageHeight * 0.5);
    ctx.lineTo(imageWidth * 0.163551, imageHeight * 0.523364);
    ctx.lineTo(imageWidth * 0.163551, imageHeight * 0.471962);
    ctx.closePath();
    ctx.fill();

    // FRAMERIGHT
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(imageWidth * 0.799065, imageHeight * 0.434579);
    ctx.lineTo(imageWidth * 0.836448, imageHeight * 0.434579);
    ctx.lineTo(imageWidth * 0.836448, imageHeight * 0.560747);
    ctx.lineTo(imageWidth * 0.799065, imageHeight * 0.560747);
    ctx.lineWidth = 1;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';
    ctx.stroke();

    // TRIANGLERIGHT
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(imageWidth * 0.836448, imageHeight * 0.471962);
    ctx.lineTo(imageWidth * 0.794392, imageHeight * 0.5);
    ctx.lineTo(imageWidth * 0.836448, imageHeight * 0.523364);
    ctx.lineTo(imageWidth * 0.836448, imageHeight * 0.471962);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  };

  const drawPointerImage = function (ctx) {
    ctx.save();

    // POINTER_LEVEL
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(imageWidth * 0.523364, imageHeight * 0.350467);
    ctx.lineTo(imageWidth * 0.5, imageHeight * 0.130841);
    ctx.lineTo(imageWidth * 0.476635, imageHeight * 0.350467);
    ctx.bezierCurveTo(
      imageWidth * 0.476635,
      imageHeight * 0.350467,
      imageWidth * 0.490654,
      imageHeight * 0.345794,
      imageWidth * 0.5,
      imageHeight * 0.345794
    );
    ctx.bezierCurveTo(
      imageWidth * 0.509345,
      imageHeight * 0.345794,
      imageWidth * 0.523364,
      imageHeight * 0.350467,
      imageWidth * 0.523364,
      imageHeight * 0.350467
    );
    ctx.closePath();
    const POINTER_LEVEL_GRADIENT = ctx.createLinearGradient(
      0,
      0.154205 * imageHeight,
      0,
      0.350466 * imageHeight
    );
    const tmpDarkColor = pointerColor.dark;
    const tmpLightColor = pointerColor.light;
    tmpDarkColor.setAlpha(0.70588);
    tmpLightColor.setAlpha(0.70588);
    POINTER_LEVEL_GRADIENT.addColorStop(0, tmpDarkColor.getRgbaColor());
    POINTER_LEVEL_GRADIENT.addColorStop(0.3, tmpLightColor.getRgbaColor());
    POINTER_LEVEL_GRADIENT.addColorStop(0.59, tmpLightColor.getRgbaColor());
    POINTER_LEVEL_GRADIENT.addColorStop(1, tmpDarkColor.getRgbaColor());
    ctx.fillStyle = POINTER_LEVEL_GRADIENT;
    const strokeColor_POINTER_LEVEL = pointerColor.light.getRgbaColor();
    ctx.lineWidth = 1;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';
    ctx.strokeStyle = strokeColor_POINTER_LEVEL;
    ctx.fill();
    ctx.stroke();

    tmpDarkColor.setAlpha(1);
    tmpLightColor.setAlpha(1);

    ctx.restore();
  };

  const drawStepPointerImage = function (ctx) {
    ctx.save();

    const tmpDarkColor = pointerColor.dark;
    const tmpLightColor = pointerColor.light;
    tmpDarkColor.setAlpha(0.70588);
    tmpLightColor.setAlpha(0.70588);

    // POINTER_LEVEL_LEFT
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(imageWidth * 0.285046, imageHeight * 0.514018);
    ctx.lineTo(imageWidth * 0.21028, imageHeight * 0.5);
    ctx.lineTo(imageWidth * 0.285046, imageHeight * 0.481308);
    ctx.bezierCurveTo(
      imageWidth * 0.285046,
      imageHeight * 0.481308,
      imageWidth * 0.280373,
      imageHeight * 0.490654,
      imageWidth * 0.280373,
      imageHeight * 0.495327
    );
    ctx.bezierCurveTo(
      imageWidth * 0.280373,
      imageHeight * 0.504672,
      imageWidth * 0.285046,
      imageHeight * 0.514018,
      imageWidth * 0.285046,
      imageHeight * 0.514018
    );
    ctx.closePath();
    const POINTER_LEVEL_LEFT_GRADIENT = ctx.createLinearGradient(
      0.224299 * imageWidth,
      0,
      0.289719 * imageWidth,
      0
    );
    POINTER_LEVEL_LEFT_GRADIENT.addColorStop(0, tmpDarkColor.getRgbaColor());
    POINTER_LEVEL_LEFT_GRADIENT.addColorStop(0.3, tmpLightColor.getRgbaColor());
    POINTER_LEVEL_LEFT_GRADIENT.addColorStop(
      0.59,
      tmpLightColor.getRgbaColor()
    );
    POINTER_LEVEL_LEFT_GRADIENT.addColorStop(1, tmpDarkColor.getRgbaColor());
    ctx.fillStyle = POINTER_LEVEL_LEFT_GRADIENT;
    const strokeColor_POINTER_LEVEL_LEFT = pointerColor.light.getRgbaColor();
    ctx.lineWidth = 1;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';
    ctx.strokeStyle = strokeColor_POINTER_LEVEL_LEFT;
    ctx.fill();
    ctx.stroke();

    // POINTER_LEVEL_RIGHT
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(imageWidth * 0.714953, imageHeight * 0.514018);
    ctx.lineTo(imageWidth * 0.789719, imageHeight * 0.5);
    ctx.lineTo(imageWidth * 0.714953, imageHeight * 0.481308);
    ctx.bezierCurveTo(
      imageWidth * 0.714953,
      imageHeight * 0.481308,
      imageWidth * 0.719626,
      imageHeight * 0.490654,
      imageWidth * 0.719626,
      imageHeight * 0.495327
    );
    ctx.bezierCurveTo(
      imageWidth * 0.719626,
      imageHeight * 0.504672,
      imageWidth * 0.714953,
      imageHeight * 0.514018,
      imageWidth * 0.714953,
      imageHeight * 0.514018
    );
    ctx.closePath();
    const POINTER_LEVEL_RIGHT_GRADIENT = ctx.createLinearGradient(
      0.7757 * imageWidth,
      0,
      0.71028 * imageWidth,
      0
    );
    POINTER_LEVEL_RIGHT_GRADIENT.addColorStop(0, tmpDarkColor.getRgbaColor());
    POINTER_LEVEL_RIGHT_GRADIENT.addColorStop(
      0.3,
      tmpLightColor.getRgbaColor()
    );
    POINTER_LEVEL_RIGHT_GRADIENT.addColorStop(
      0.59,
      tmpLightColor.getRgbaColor()
    );
    POINTER_LEVEL_RIGHT_GRADIENT.addColorStop(1, tmpDarkColor.getRgbaColor());
    ctx.fillStyle = POINTER_LEVEL_RIGHT_GRADIENT;
    const strokeColor_POINTER_LEVEL_RIGHT = pointerColor.light.getRgbaColor();
    ctx.lineWidth = 1;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';
    ctx.strokeStyle = strokeColor_POINTER_LEVEL_RIGHT;
    ctx.fill();
    ctx.stroke();

    tmpDarkColor.setAlpha(1);
    tmpLightColor.setAlpha(1);

    ctx.restore();
  };

  // **************   Initialization  ********************
  // Draw all static painting code to background
  const init = function () {
    initialized = true;

    if (frameVisible) {
      drawFrame(
        backgroundContext,
        frameDesign,
        centerX,
        centerY,
        imageWidth,
        imageHeight
      );
    }

    if (backgroundVisible) {
      drawBackground(
        backgroundContext,
        backgroundColor,
        centerX,
        centerY,
        imageWidth,
        imageHeight
      );
      drawTickmarksImage(backgroundContext);
    }

    drawMarkerImage(pointerContext);

    drawPointerImage(pointerContext);

    drawStepPointerImage(stepPointerContext);

    if (foregroundVisible) {
      drawForeground(
        foregroundContext,
        foregroundType,
        imageWidth,
        imageHeight,
        false
      );
    }
  };

  const repaint = function () {
    if (!initialized) {
      init();
    }

    mainCtx.save();
    mainCtx.clearRect(0, 0, mainCtx.canvas.width, mainCtx.canvas.height);

    angle = HALF_PI + value * angleStep - HALF_PI;
    if (rotateFace) {
      mainCtx.translate(centerX, centerY);
      mainCtx.rotate(-angle);
      mainCtx.translate(-centerX, -centerY);
    }
    // Draw buffered image to visible canvas
    if (frameVisible || backgroundVisible) {
      mainCtx.drawImage(backgroundBuffer, 0, 0);
    }

    mainCtx.save();
    // Define rotation center
    mainCtx.translate(centerX, centerY);
    mainCtx.rotate(angle);

    // Draw pointer
    mainCtx.translate(-centerX, -centerY);
    mainCtx.drawImage(pointerBuffer, 0, 0);

    mainCtx.fillStyle = backgroundColor.labelColor.getRgbaColor();
    mainCtx.textAlign = 'center';
    mainCtx.textBaseline = 'middle';

    if (textOrientationFixed) {
      mainCtx.restore();
      if (decimalsVisible) {
        mainCtx.font = imageWidth * 0.1 + 'px ' + stdFontName;
      } else {
        mainCtx.font = imageWidth * 0.15 + 'px ' + stdFontName;
      }
      mainCtx.fillText(
        visibleValue.toFixed(decimals) + '\u00B0',
        centerX,
        centerY,
        imageWidth * 0.35
      );
    } else {
      if (decimalsVisible) {
        mainCtx.font = imageWidth * 0.15 + 'px ' + stdFontName;
      } else {
        mainCtx.font = imageWidth * 0.2 + 'px ' + stdFontName;
      }
      mainCtx.fillText(
        visibleValue.toFixed(decimals) + '\u00B0',
        centerX,
        centerY,
        imageWidth * 0.35
      );
      mainCtx.restore();
    }

    mainCtx.translate(centerX, centerY);
    mainCtx.rotate(angle + stepValue * RAD_FACTOR);
    mainCtx.translate(-centerX, -centerY);
    mainCtx.drawImage(stepPointerBuffer, 0, 0);
    mainCtx.restore();

    // Draw foreground
    if (foregroundVisible) {
      mainCtx.drawImage(foregroundBuffer, 0, 0);
    }

    mainCtx.restore();
  };

  // Visualize the component
  repaint();
}

class LevelElement extends BaseElement {
  static get drawFunction () { return drawLevel }

  static get properties () {
    return {
      size: { type: Number, defaultValue: 200 },
      value: { type: Number, defaultValue: 0 },
      real_value: { state: true },
      transitionTime: { type: Number, defaultValue: 500 },
      decimalsVisible: { type: Boolean, defaultValue: false },
      textOrientationFixed: { type: Boolean, defaultValue: false },
      frameDesign: { type: String, objectEnum: FrameDesign, defaultValue: 'METAL' },
      noFrameVisible: { type: Boolean, defaultValue: false },
      backgroundColor: { type: String, objectEnum: BackgroundColor, defaultValue: 'DARK_GRAY' },
      noBackgroundVisible: { type: Boolean, defaultValue: false },
      pointerColor: { type: String, objectEnum: Color$1, defaultValue: 'RED' },
      foregroundType: { type: String, objectEnum: ForegroundType, defaultValue: 'TYPE1' },
      noForegroundVisible: { type: Boolean, defaultValue: false },
      rotateFace: { type: Boolean, defaultValue: false }
    }
  }

  constructor () {
    super();
    this._timer = timer(() => {});
    this._timer.stop();
  }

  connectedCallback () {
    super.connectedCallback();
    this.real_value = this.real_value ?? 0;
  }

  render () {
    return $`
      <canvas width="${this.size}" height="${this.size}"></canvas>
    `
  }

  updated (changedProperties) {
    super.updated();
    if (changedProperties.has('value') || changedProperties.has('transitionTime')) {
      const transitionTime = this.transitionTime;
      const originTime = now();
      const originValue = this.real_value;
      const targetValue = this.value;
      const timeScale = transitionTime <= 0 ? () => 1 : linear().domain([0, transitionTime]).clamp(true);
      const valueScale = linear().range([originValue, targetValue]).clamp(true);
      this._timer.restart((elapsedTime) => {
        const scaled = timeScale(elapsedTime);
        const eased = cubicInOut(scaled);
        const newValue = valueScale(eased);
        this.real_value = newValue;
        if (now() >= originTime + transitionTime) {
          this._timer.stop();
        }
      });
    }
  }
}

window.customElements.define('steelseries-level', LevelElement);

const drawRoseImage = function (
  ctx,
  centerX,
  centerY,
  imageWidth,
  imageHeight,
  backgroundColor
) {
  let fill = true;
  let i;
  let grad;
  const symbolColor = backgroundColor.symbolColor.getRgbaColor();

  ctx.save();
  ctx.lineWidth = 1;
  ctx.fillStyle = symbolColor;
  ctx.strokeStyle = symbolColor;
  ctx.translate(centerX, centerY);
  // broken ring
  for (i = 0; i < 360; i += 15) {
    fill = !fill;

    ctx.beginPath();
    ctx.arc(
      0,
      0,
      imageWidth * 0.26,
      i * RAD_FACTOR,
      (i + 15) * RAD_FACTOR,
      false
    );
    ctx.arc(
      0,
      0,
      imageWidth * 0.23,
      (i + 15) * RAD_FACTOR,
      i * RAD_FACTOR,
      true
    );
    ctx.closePath();
    if (fill) {
      ctx.fill();
    }
    ctx.stroke();
  }

  ctx.translate(-centerX, -centerY);

  for (i = 0; i <= 360; i += 90) {
    // Small pointers
    ctx.beginPath();
    ctx.moveTo(imageWidth * 0.560747, imageHeight * 0.584112);
    ctx.lineTo(imageWidth * 0.640186, imageHeight * 0.644859);
    ctx.lineTo(imageWidth * 0.584112, imageHeight * 0.560747);
    ctx.lineTo(imageWidth * 0.560747, imageHeight * 0.584112);
    ctx.closePath();
    ctx.fillStyle = symbolColor;
    ctx.fill();
    ctx.stroke();
    // Large pointers
    ctx.beginPath();
    ctx.moveTo(imageWidth * 0.523364, imageHeight * 0.397196);
    ctx.lineTo(imageWidth * 0.5, imageHeight * 0.196261);
    ctx.lineTo(imageWidth * 0.471962, imageHeight * 0.397196);
    ctx.lineTo(imageWidth * 0.523364, imageHeight * 0.397196);
    ctx.closePath();
    grad = ctx.createLinearGradient(
      0.476635 * imageWidth,
      0,
      0.518691 * imageWidth,
      0
    );
    grad.addColorStop(0, 'rgb(222, 223, 218)');
    grad.addColorStop(0.48, 'rgb(222, 223, 218)');
    grad.addColorStop(0.49, symbolColor);
    grad.addColorStop(1, symbolColor);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.stroke();
    ctx.translate(centerX, centerY);
    ctx.rotate(i * RAD_FACTOR);
    ctx.translate(-centerX, -centerY);
  }

  // Central ring
  ctx.beginPath();
  ctx.translate(centerX, centerY);
  ctx.arc(0, 0, imageWidth * 0.1, 0, TWO_PI, false);
  ctx.lineWidth = imageWidth * 0.022;
  ctx.stroke();
  ctx.translate(-centerX, -centerY);

  ctx.restore();
};

function drawCompass (canvas, parameters) {
  parameters = parameters || {};
  let size = undefined === parameters.size ? 0 : parameters.size;
  const frameDesign =
    undefined === parameters.frameDesign
      ? FrameDesign.METAL
      : parameters.frameDesign;
  const frameVisible =
    undefined === parameters.frameVisible ? true : parameters.frameVisible;
  const backgroundColor =
    undefined === parameters.backgroundColor
      ? BackgroundColor.DARK_GRAY
      : parameters.backgroundColor;
  const backgroundVisible =
    undefined === parameters.backgroundVisible
      ? true
      : parameters.backgroundVisible;
  const pointerType =
    undefined === parameters.pointerType
      ? PointerType.TYPE2
      : parameters.pointerType;
  const pointerColor =
    undefined === parameters.pointerColor
      ? Color$1.RED
      : parameters.pointerColor;
  const knobType =
    undefined === parameters.knobType
      ? KnobType.STANDARD_KNOB
      : parameters.knobType;
  const knobStyle =
    undefined === parameters.knobStyle
      ? KnobStyle.SILVER
      : parameters.knobStyle;
  const foregroundType =
    undefined === parameters.foregroundType
      ? ForegroundType.TYPE1
      : parameters.foregroundType;
  const foregroundVisible =
    undefined === parameters.foregroundVisible
      ? true
      : parameters.foregroundVisible;
  const pointSymbols =
    undefined === parameters.pointSymbols
      ? ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
      : parameters.pointSymbols;
  const pointSymbolsVisible =
    undefined === parameters.pointSymbolsVisible
      ? true
      : parameters.pointSymbolsVisible;
  const customLayer =
    undefined === parameters.customLayer ? null : parameters.customLayer;
  const degreeScale =
    undefined === parameters.degreeScale ? false : parameters.degreeScale;
  const roseVisible =
    undefined === parameters.roseVisible ? true : parameters.roseVisible;
  const rotateFace =
    undefined === parameters.rotateFace ? false : parameters.rotateFace;

  const value = parameters.value ?? 0;
  const angleStep = RAD_FACTOR;
  let angle;

  // Get the canvas context and clear it
  const mainCtx = getCanvasContext(canvas);
  // Has a size been specified?
  if (size === 0) {
    size = Math.min(mainCtx.canvas.width, mainCtx.canvas.height);
  }

  // Set the size - also clears the canvas
  mainCtx.canvas.width = size;
  mainCtx.canvas.height = size;

  const imageWidth = size;
  const imageHeight = size;

  const centerX = imageWidth / 2;
  const centerY = imageHeight / 2;

  const shadowOffset = imageWidth * 0.006;

  let initialized = false;

  // **************   Buffer creation  ********************
  // Buffer for all static background painting code
  const backgroundBuffer = createBuffer(size, size);
  const backgroundContext = backgroundBuffer.getContext('2d');

  // Buffer for symbol/rose painting code
  const roseBuffer = createBuffer(size, size);
  const roseContext = roseBuffer.getContext('2d');

  // Buffer for pointer image painting code
  const pointerBuffer = createBuffer(size, size);
  const pointerContext = pointerBuffer.getContext('2d');

  // Buffer for static foreground painting code
  const foregroundBuffer = createBuffer(size, size);
  const foregroundContext = foregroundBuffer.getContext('2d');

  // **************   Image creation  ********************
  const drawTickmarksImage = function (ctx) {
    let val;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let stdFont;
    let smlFont;
    let i;

    ctx.save();
    ctx.strokeStyle = backgroundColor.labelColor.getRgbaColor();
    ctx.fillStyle = backgroundColor.labelColor.getRgbaColor();
    ctx.translate(centerX, centerY);

    if (!degreeScale) {
      stdFont = 0.12 * imageWidth + 'px serif';
      smlFont = 0.06 * imageWidth + 'px serif';

      for (i = 0; i < 360; i += 2.5) {
        if (i % 5 === 0) {
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(imageWidth * 0.38, 0);
          ctx.lineTo(imageWidth * 0.36, 0);
          ctx.closePath();
          ctx.stroke();
        }

        // Draw the labels
        ctx.save();
        switch (i) {
          case 0:
            ctx.translate(imageWidth * 0.35, 0);
            ctx.rotate(HALF_PI);
            ctx.font = stdFont;
            ctx.fillText(pointSymbols[2], 0, 0, imageWidth);
            ctx.translate(-imageWidth * 0.35, 0);
            break
          case 45:
            ctx.translate(imageWidth * 0.29, 0);
            ctx.rotate(HALF_PI);
            ctx.font = smlFont;
            ctx.fillText(pointSymbols[3], 0, 0, imageWidth);
            ctx.translate(-imageWidth * 0.29, 0);
            break
          case 90:
            ctx.translate(imageWidth * 0.35, 0);
            ctx.rotate(HALF_PI);
            ctx.font = stdFont;
            ctx.fillText(pointSymbols[4], 0, 0, imageWidth);
            ctx.translate(-imageWidth * 0.35, 0);
            break
          case 135:
            ctx.translate(imageWidth * 0.29, 0);
            ctx.rotate(HALF_PI);
            ctx.font = smlFont;
            ctx.fillText(pointSymbols[5], 0, 0, imageWidth);
            ctx.translate(-imageWidth * 0.29, 0);
            break
          case 180:
            ctx.translate(imageWidth * 0.35, 0);
            ctx.rotate(HALF_PI);
            ctx.font = stdFont;
            ctx.fillText(pointSymbols[6], 0, 0, imageWidth);
            ctx.translate(-imageWidth * 0.35, 0);
            break
          case 225:
            ctx.translate(imageWidth * 0.29, 0);
            ctx.rotate(HALF_PI);
            ctx.font = smlFont;
            ctx.fillText(pointSymbols[7], 0, 0, imageWidth);
            ctx.translate(-imageWidth * 0.29, 0);
            break
          case 270:
            ctx.translate(imageWidth * 0.35, 0);
            ctx.rotate(HALF_PI);
            ctx.font = stdFont;
            ctx.fillText(pointSymbols[0], 0, 0, imageWidth);
            ctx.translate(-imageWidth * 0.35, 0);
            break
          case 315:
            ctx.translate(imageWidth * 0.29, 0);
            ctx.rotate(HALF_PI);
            ctx.font = smlFont;
            ctx.fillText(pointSymbols[1], 0, 0, imageWidth);
            ctx.translate(-imageWidth * 0.29, 0);
            break
        }
        ctx.restore();

        if (
          roseVisible &&
          (i === 0 ||
            i === 22.5 ||
            i === 45 ||
            i === 67.5 ||
            i === 90 ||
            i === 112.5 ||
            i === 135 ||
            i === 157.5 ||
            i === 180 ||
            i === 202.5 ||
            i === 225 ||
            i === 247.5 ||
            i === 270 ||
            i === 292.5 ||
            i === 315 ||
            i === 337.5 ||
            i === 360)
        ) {
          // ROSE_LINE
          ctx.save();
          ctx.beginPath();
          // indent the 16 half quadrant lines a bit for visual effect
          if (i % 45) {
            ctx.moveTo(imageWidth * 0.29, 0);
          } else {
            ctx.moveTo(imageWidth * 0.38, 0);
          }
          ctx.lineTo(imageWidth * 0.1, 0);
          ctx.closePath();
          ctx.restore();
          ctx.lineWidth = 1;
          ctx.strokeStyle = backgroundColor.symbolColor.getRgbaColor();
          ctx.stroke();
        }
        ctx.rotate(angleStep * 2.5);
      }
    } else {
      stdFont = 0.08 * imageWidth + 'px serif';
      smlFont = imageWidth * 0.033 + 'px serif';

      ctx.rotate(angleStep * 10);

      for (i = 10; i <= 360; i += 10) {
        // Draw the labels
        ctx.save();
        if (pointSymbolsVisible) {
          switch (i) {
            case 360:
              ctx.translate(imageWidth * 0.35, 0);
              ctx.rotate(HALF_PI);
              ctx.font = stdFont;
              ctx.fillText(pointSymbols[2], 0, 0, imageWidth);
              ctx.translate(-imageWidth * 0.35, 0);
              break
            case 90:
              ctx.translate(imageWidth * 0.35, 0);
              ctx.rotate(HALF_PI);
              ctx.font = stdFont;
              ctx.fillText(pointSymbols[4], 0, 0, imageWidth);
              ctx.translate(-imageWidth * 0.35, 0);
              break
            case 180:
              ctx.translate(imageWidth * 0.35, 0);
              ctx.rotate(HALF_PI);
              ctx.font = stdFont;
              ctx.fillText(pointSymbols[6], 0, 0, imageWidth);
              ctx.translate(-imageWidth * 0.35, 0);
              break
            case 270:
              ctx.translate(imageWidth * 0.35, 0);
              ctx.rotate(HALF_PI);
              ctx.font = stdFont;
              ctx.fillText(pointSymbols[0], 0, 0, imageWidth);
              ctx.translate(-imageWidth * 0.35, 0);
              break
            default:
              val = (i + 90) % 360;
              ctx.translate(imageWidth * 0.37, 0);
              ctx.rotate(HALF_PI);
              ctx.font = smlFont;
              ctx.fillText('0'.substring(val >= 100) + val, 0, 0, imageWidth);
              ctx.translate(-imageWidth * 0.37, 0);
          }
        } else {
          val = (i + 90) % 360;
          ctx.translate(imageWidth * 0.37, 0);
          ctx.rotate(HALF_PI);
          ctx.font = smlFont;
          ctx.fillText('0'.substring(val >= 100) + val, 0, 0, imageWidth);
          ctx.translate(-imageWidth * 0.37, 0);
        }
        ctx.restore();
        ctx.rotate(angleStep * 10);
      }
    }
    ctx.translate(-centerX, -centerY);
    ctx.restore();
  };

  const drawPointerImage = function (ctx) {
    ctx.save();

    switch (pointerType.type) {
      case 'type2': {
        // NORTHPOINTER
        ctx.beginPath();
        ctx.moveTo(imageWidth * 0.53271, imageHeight * 0.453271);
        ctx.bezierCurveTo(
          imageWidth * 0.53271,
          imageHeight * 0.453271,
          imageWidth * 0.5,
          imageHeight * 0.149532,
          imageWidth * 0.5,
          imageHeight * 0.149532
        );
        ctx.bezierCurveTo(
          imageWidth * 0.5,
          imageHeight * 0.149532,
          imageWidth * 0.467289,
          imageHeight * 0.453271,
          imageWidth * 0.467289,
          imageHeight * 0.453271
        );
        ctx.bezierCurveTo(
          imageWidth * 0.453271,
          imageHeight * 0.462616,
          imageWidth * 0.443925,
          imageHeight * 0.481308,
          imageWidth * 0.443925,
          imageHeight * 0.5
        );
        ctx.bezierCurveTo(
          imageWidth * 0.443925,
          imageHeight * 0.5,
          imageWidth * 0.556074,
          imageHeight * 0.5,
          imageWidth * 0.556074,
          imageHeight * 0.5
        );
        ctx.bezierCurveTo(
          imageWidth * 0.556074,
          imageHeight * 0.481308,
          imageWidth * 0.546728,
          imageHeight * 0.462616,
          imageWidth * 0.53271,
          imageHeight * 0.453271
        );
        ctx.closePath();
        const NORTHPOINTER2_GRADIENT = ctx.createLinearGradient(
          0.471962 * imageWidth,
          0,
          0.528036 * imageWidth,
          0
        );
        NORTHPOINTER2_GRADIENT.addColorStop(
          0,
          pointerColor.light.getRgbaColor()
        );
        NORTHPOINTER2_GRADIENT.addColorStop(
          0.46,
          pointerColor.light.getRgbaColor()
        );
        NORTHPOINTER2_GRADIENT.addColorStop(
          0.47,
          pointerColor.medium.getRgbaColor()
        );
        NORTHPOINTER2_GRADIENT.addColorStop(
          1,
          pointerColor.medium.getRgbaColor()
        );
        ctx.fillStyle = NORTHPOINTER2_GRADIENT;
        ctx.strokeStyle = pointerColor.dark.getRgbaColor();
        ctx.lineWidth = 1;
        ctx.lineCap = 'square';
        ctx.lineJoin = 'miter';
        ctx.fill();
        ctx.stroke();

        // SOUTHPOINTER
        ctx.beginPath();
        ctx.moveTo(imageWidth * 0.467289, imageHeight * 0.546728);
        ctx.bezierCurveTo(
          imageWidth * 0.467289,
          imageHeight * 0.546728,
          imageWidth * 0.5,
          imageHeight * 0.850467,
          imageWidth * 0.5,
          imageHeight * 0.850467
        );
        ctx.bezierCurveTo(
          imageWidth * 0.5,
          imageHeight * 0.850467,
          imageWidth * 0.53271,
          imageHeight * 0.546728,
          imageWidth * 0.53271,
          imageHeight * 0.546728
        );
        ctx.bezierCurveTo(
          imageWidth * 0.546728,
          imageHeight * 0.537383,
          imageWidth * 0.556074,
          imageHeight * 0.518691,
          imageWidth * 0.556074,
          imageHeight * 0.5
        );
        ctx.bezierCurveTo(
          imageWidth * 0.556074,
          imageHeight * 0.5,
          imageWidth * 0.443925,
          imageHeight * 0.5,
          imageWidth * 0.443925,
          imageHeight * 0.5
        );
        ctx.bezierCurveTo(
          imageWidth * 0.443925,
          imageHeight * 0.518691,
          imageWidth * 0.453271,
          imageHeight * 0.537383,
          imageWidth * 0.467289,
          imageHeight * 0.546728
        );
        ctx.closePath();
        const SOUTHPOINTER2_GRADIENT = ctx.createLinearGradient(
          0.471962 * imageWidth,
          0,
          0.528036 * imageWidth,
          0
        );
        SOUTHPOINTER2_GRADIENT.addColorStop(0, '#e3e5e8');
        SOUTHPOINTER2_GRADIENT.addColorStop(0.48, '#e3e5e8');
        SOUTHPOINTER2_GRADIENT.addColorStop(0.48, '#abb1b8');
        SOUTHPOINTER2_GRADIENT.addColorStop(1, '#abb1b8');
        ctx.fillStyle = SOUTHPOINTER2_GRADIENT;
        const strokeColor_SOUTHPOINTER2 = '#abb1b8';
        ctx.strokeStyle = strokeColor_SOUTHPOINTER2;
        ctx.lineWidth = 1;
        ctx.lineCap = 'square';
        ctx.lineJoin = 'miter';
        ctx.fill();
        ctx.stroke();
      }
        break

      case 'type3': {
        // NORTHPOINTER
        ctx.beginPath();
        ctx.moveTo(imageWidth * 0.5, imageHeight * 0.149532);
        ctx.bezierCurveTo(
          imageWidth * 0.5,
          imageHeight * 0.149532,
          imageWidth * 0.443925,
          imageHeight * 0.490654,
          imageWidth * 0.443925,
          imageHeight * 0.5
        );
        ctx.bezierCurveTo(
          imageWidth * 0.443925,
          imageHeight * 0.53271,
          imageWidth * 0.467289,
          imageHeight * 0.556074,
          imageWidth * 0.5,
          imageHeight * 0.556074
        );
        ctx.bezierCurveTo(
          imageWidth * 0.53271,
          imageHeight * 0.556074,
          imageWidth * 0.556074,
          imageHeight * 0.53271,
          imageWidth * 0.556074,
          imageHeight * 0.5
        );
        ctx.bezierCurveTo(
          imageWidth * 0.556074,
          imageHeight * 0.490654,
          imageWidth * 0.5,
          imageHeight * 0.149532,
          imageWidth * 0.5,
          imageHeight * 0.149532
        );
        ctx.closePath();
        const NORTHPOINTER3_GRADIENT = ctx.createLinearGradient(
          0.471962 * imageWidth,
          0,
          0.528036 * imageWidth,
          0
        );
        NORTHPOINTER3_GRADIENT.addColorStop(
          0,
          pointerColor.light.getRgbaColor()
        );
        NORTHPOINTER3_GRADIENT.addColorStop(
          0.46,
          pointerColor.light.getRgbaColor()
        );
        NORTHPOINTER3_GRADIENT.addColorStop(
          0.47,
          pointerColor.medium.getRgbaColor()
        );
        NORTHPOINTER3_GRADIENT.addColorStop(
          1,
          pointerColor.medium.getRgbaColor()
        );
        ctx.fillStyle = NORTHPOINTER3_GRADIENT;
        ctx.strokeStyle = pointerColor.dark.getRgbaColor();
        ctx.lineWidth = 1;
        ctx.lineCap = 'square';
        ctx.lineJoin = 'miter';
        ctx.fill();
        ctx.stroke();
      }
        break

      case 'type1:':
      /* falls through */
      default: {
        // NORTHPOINTER
        ctx.beginPath();
        ctx.moveTo(imageWidth * 0.5, imageHeight * 0.495327);
        ctx.lineTo(imageWidth * 0.528037, imageHeight * 0.495327);
        ctx.lineTo(imageWidth * 0.5, imageHeight * 0.149532);
        ctx.lineTo(imageWidth * 0.471962, imageHeight * 0.495327);
        ctx.lineTo(imageWidth * 0.5, imageHeight * 0.495327);
        ctx.closePath();
        const NORTHPOINTER1_GRADIENT = ctx.createLinearGradient(
          0.471962 * imageWidth,
          0,
          0.528036 * imageWidth,
          0
        );
        NORTHPOINTER1_GRADIENT.addColorStop(
          0,
          pointerColor.light.getRgbaColor()
        );
        NORTHPOINTER1_GRADIENT.addColorStop(
          0.46,
          pointerColor.light.getRgbaColor()
        );
        NORTHPOINTER1_GRADIENT.addColorStop(
          0.47,
          pointerColor.medium.getRgbaColor()
        );
        NORTHPOINTER1_GRADIENT.addColorStop(
          1,
          pointerColor.medium.getRgbaColor()
        );
        ctx.fillStyle = NORTHPOINTER1_GRADIENT;
        ctx.strokeStyle = pointerColor.dark.getRgbaColor();
        ctx.lineWidth = 1;
        ctx.lineCap = 'square';
        ctx.lineJoin = 'miter';
        ctx.fill();
        ctx.stroke();

        // SOUTHPOINTER
        ctx.beginPath();
        ctx.moveTo(imageWidth * 0.5, imageHeight * 0.504672);
        ctx.lineTo(imageWidth * 0.471962, imageHeight * 0.504672);
        ctx.lineTo(imageWidth * 0.5, imageHeight * 0.850467);
        ctx.lineTo(imageWidth * 0.528037, imageHeight * 0.504672);
        ctx.lineTo(imageWidth * 0.5, imageHeight * 0.504672);
        ctx.closePath();
        const SOUTHPOINTER1_GRADIENT = ctx.createLinearGradient(
          0.471962 * imageWidth,
          0,
          0.528036 * imageWidth,
          0
        );
        SOUTHPOINTER1_GRADIENT.addColorStop(0, '#e3e5e8');
        SOUTHPOINTER1_GRADIENT.addColorStop(0.48, '#e3e5e8');
        SOUTHPOINTER1_GRADIENT.addColorStop(0.480099, '#abb1b8');
        SOUTHPOINTER1_GRADIENT.addColorStop(1, '#abb1b8');
        ctx.fillStyle = SOUTHPOINTER1_GRADIENT;
        const strokeColor_SOUTHPOINTER = '#abb1b8';
        ctx.strokeStyle = strokeColor_SOUTHPOINTER;
        ctx.lineWidth = 1;
        ctx.lineCap = 'square';
        ctx.lineJoin = 'miter';
        ctx.fill();
        ctx.stroke();
      }
        break
    }
    ctx.restore();
  };

  // **************   Initialization  ********************
  // Draw all static painting code to background
  const init = function () {
    initialized = true;

    if (frameVisible) {
      drawFrame(
        backgroundContext,
        frameDesign,
        centerX,
        centerY,
        imageWidth,
        imageHeight
      );
    }

    if (backgroundVisible) {
      drawBackground(
        backgroundContext,
        backgroundColor,
        centerX,
        centerY,
        imageWidth,
        imageHeight
      );
      drawRadialCustomImage(
        backgroundContext,
        customLayer,
        centerX,
        centerY,
        imageWidth,
        imageHeight
      );

      if (roseVisible) {
        drawRoseImage(
          roseContext,
          centerX,
          centerY,
          imageWidth,
          imageHeight,
          backgroundColor
        );
      }

      drawTickmarksImage(roseContext);
    }

    drawPointerImage(pointerContext);

    if (foregroundVisible) {
      drawForeground(
        foregroundContext,
        foregroundType,
        imageWidth,
        imageHeight,
        true,
        knobType,
        knobStyle
      );
    }
  };

  const repaint = function () {
    if (!initialized) {
      init();
    }

    mainCtx.save();
    mainCtx.clearRect(0, 0, mainCtx.canvas.width, mainCtx.canvas.height);
    // Define rotation center
    angle = HALF_PI + value * angleStep - HALF_PI;

    if (backgroundVisible || frameVisible) {
      mainCtx.drawImage(backgroundBuffer, 0, 0);
    }

    if (rotateFace) {
      mainCtx.save();
      mainCtx.translate(centerX, centerY);
      mainCtx.rotate(-angle);
      mainCtx.translate(-centerX, -centerY);
      if (backgroundVisible) {
        mainCtx.drawImage(roseBuffer, 0, 0);
      }
      mainCtx.restore();
    } else {
      if (backgroundVisible) {
        mainCtx.drawImage(roseBuffer, 0, 0);
      }
      mainCtx.translate(centerX, centerY);
      mainCtx.rotate(angle);
      mainCtx.translate(-centerX, -centerY);
    }
    // Set the pointer shadow params
    mainCtx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    mainCtx.shadowOffsetX = mainCtx.shadowOffsetY = shadowOffset;
    mainCtx.shadowBlur = shadowOffset * 2;
    // Draw the pointer
    mainCtx.drawImage(pointerBuffer, 0, 0);
    // Undo the translations & shadow settings
    mainCtx.restore();

    if (foregroundVisible) {
      mainCtx.drawImage(foregroundBuffer, 0, 0);
    }
  };

  // Visualize the component
  repaint();
}

class CompassElement extends BaseElement {
  static get drawFunction () { return drawCompass }

  static get properties () {
    return {
      size: { type: Number, defaultValue: 200 },
      value: { type: Number, defaultValue: 0 },
      real_value: { state: true },
      transitionTime: { type: Number, defaultValue: 500 },
      frameDesign: { type: String, objectEnum: FrameDesign, defaultValue: 'METAL' },
      noFrameVisible: { type: Boolean, defaultValue: false },
      backgroundColor: { type: String, objectEnum: BackgroundColor, defaultValue: 'DARK_GRAY' },
      noBackgroundVisible: { type: Boolean, defaultValue: false },
      pointerType: { type: String, objectEnum: PointerType, defaultValue: 'TYPE1' },
      pointerColor: { type: String, objectEnum: Color$1, defaultValue: 'GRAY' },
      knobType: { type: String, objectEnum: KnobType, defaultValue: 'METAL_KNOB' },
      knobStyle: { type: String, objectEnum: KnobStyle, defaultValue: 'BLACK' },
      foregroundType: { type: String, objectEnum: ForegroundType, defaultValue: 'TYPE1' },
      noForegroundVisible: { type: Boolean, defaultValue: false },
      pointSymbols: { type: Array, defaultValue: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] },
      noPointSymbolsVisible: { type: Boolean, defaultValue: false },
      degreeScale: { type: Boolean, defaultValue: false },
      noRoseVisible: { type: Boolean, defaultValue: false },
      rotateFace: { type: Boolean, defaultValue: false }
    }
  }

  constructor () {
    super();
    this._timer = timer(() => {});
    this._timer.stop();
  }

  connectedCallback () {
    super.connectedCallback();
    this.real_value = this.real_value ?? 0;
  }

  render () {
    return $`
      <canvas width="${this.size}" height="${this.size}"></canvas>
    `
  }

  updated (changedProperties) {
    super.updated();
    if (changedProperties.has('value') || changedProperties.has('transitionTime')) {
      const transitionTime = this.transitionTime;
      const originTime = now();
      const originValue = this.real_value;
      const targetValue = this.value;
      const timeScale = transitionTime <= 0 ? () => 1 : linear().domain([0, transitionTime]).clamp(true);
      const valueScale = linear().range([originValue, targetValue]).clamp(true);
      this._timer.restart((elapsedTime) => {
        const scaled = timeScale(elapsedTime);
        const eased = cubicInOut(scaled);
        const newValue = valueScale(eased);
        this.real_value = newValue;
        if (now() >= originTime + transitionTime) {
          this._timer.stop();
        }
      });
    }
  }
}

window.customElements.define('steelseries-compass', CompassElement);

function drawWindDirection (canvas, parameters) {
  parameters = parameters || {};
  let size = undefined === parameters.size ? 0 : parameters.size;
  const frameDesign =
    undefined === parameters.frameDesign
      ? FrameDesign.METAL
      : parameters.frameDesign;
  const frameVisible =
    undefined === parameters.frameVisible ? true : parameters.frameVisible;
  const backgroundColor =
    undefined === parameters.backgroundColor
      ? BackgroundColor.DARK_GRAY
      : parameters.backgroundColor;
  const backgroundVisible =
    undefined === parameters.backgroundVisible
      ? true
      : parameters.backgroundVisible;
  const pointerTypeLatest =
    undefined === parameters.pointerTypeLatest
      ? PointerType.TYPE1
      : parameters.pointerTypeLatest;
  const pointerTypeAverage =
    undefined === parameters.pointerTypeAverage
      ? PointerType.TYPE8
      : parameters.pointerTypeAverage;
  const pointerColor =
    undefined === parameters.pointerColor
      ? Color$1.RED
      : parameters.pointerColor;
  const pointerColorAverage =
    undefined === parameters.pointerColorAverage
      ? Color$1.BLUE
      : parameters.pointerColorAverage;
  const knobType =
    undefined === parameters.knobType
      ? KnobType.STANDARD_KNOB
      : parameters.knobType;
  const knobStyle =
    undefined === parameters.knobStyle
      ? KnobStyle.SILVER
      : parameters.knobStyle;
  const foregroundType =
    undefined === parameters.foregroundType
      ? ForegroundType.TYPE1
      : parameters.foregroundType;
  const foregroundVisible =
    undefined === parameters.foregroundVisible
      ? true
      : parameters.foregroundVisible;
  const pointSymbols =
    undefined === parameters.pointSymbols
      ? ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
      : parameters.pointSymbols;
  const pointSymbolsVisible =
    undefined === parameters.pointSymbolsVisible
      ? true
      : parameters.pointSymbolsVisible;
  const customLayer =
    undefined === parameters.customLayer ? null : parameters.customLayer;
  const degreeScale =
    undefined === parameters.degreeScale ? true : parameters.degreeScale;
  const degreeScaleHalf =
    undefined === parameters.degreeScaleHalf
      ? false
      : parameters.degreeScaleHalf;
  const roseVisible =
    undefined === parameters.roseVisible ? false : parameters.roseVisible;
  const lcdColor =
    undefined === parameters.lcdColor ? LcdColor.STANDARD : parameters.lcdColor;
  const lcdVisible =
    undefined === parameters.lcdVisible ? true : parameters.lcdVisible;
  const digitalFont =
    undefined === parameters.digitalFont ? false : parameters.digitalFont;
  const section = undefined === parameters.section ? null : parameters.section;
  const area = undefined === parameters.area ? null : parameters.area;
  const lcdTitleStrings =
    undefined === parameters.lcdTitleStrings
      ? ['Latest', 'Average']
      : parameters.lcdTitleStrings;
  const titleString =
    undefined === parameters.titleString ? '' : parameters.titleString;
  const useColorLabels =
    undefined === parameters.useColorLabels ? false : parameters.useColorLabels;

  const valueLatest = parameters.valueLatest ?? 0;
  const valueAverage = parameters.valueAverage ?? 0;
  const angleStep = RAD_FACTOR;
  let angleLatest;
  let angleAverage;
  const rotationOffset = -HALF_PI;
  const angleRange = TWO_PI;
  const range = 360;

  // Get the canvas context and clear it
  const mainCtx = getCanvasContext(canvas);
  // Has a size been specified?
  if (size === 0) {
    size = Math.min(mainCtx.canvas.width, mainCtx.canvas.height);
  }

  // Set the size - also clears the canvas
  mainCtx.canvas.width = size;
  mainCtx.canvas.height = size;

  const imageWidth = size;
  const imageHeight = size;

  const centerX = imageWidth / 2;
  const centerY = imageHeight / 2;

  const lcdFontHeight = Math.floor(imageWidth / 10);
  const stdFont = lcdFontHeight + 'px ' + stdFontName;
  const lcdFont = lcdFontHeight + 'px ' + lcdFontName;
  const lcdWidth = imageWidth * 0.3;
  const lcdHeight = imageHeight * 0.12;
  const lcdPosX = (imageWidth - lcdWidth) / 2;
  const lcdPosY1 = imageHeight * 0.32;
  const lcdPosY2 = imageHeight * 0.565;

  let initialized = false;

  // **************   Buffer creation  ********************
  // Buffer for all static background painting code
  const backgroundBuffer = createBuffer(size, size);
  const backgroundContext = backgroundBuffer.getContext('2d');

  // Buffer for LCD displays
  let lcdBuffer;

  // Buffer for latest pointer images painting code
  const pointerBufferLatest = createBuffer(size, size);
  const pointerContextLatest = pointerBufferLatest.getContext('2d');

  // Buffer for average pointer image
  const pointerBufferAverage = createBuffer(size, size);
  const pointerContextAverage = pointerBufferAverage.getContext('2d');

  // Buffer for static foreground painting code
  const foregroundBuffer = createBuffer(size, size);
  const foregroundContext = foregroundBuffer.getContext('2d');

  // **************   Image creation  ********************
  const drawLcdText = function (value, bLatest) {
    mainCtx.save();
    mainCtx.textAlign = 'center';
    mainCtx.strokeStyle = lcdColor.textColor;
    mainCtx.fillStyle = lcdColor.textColor;

    // convert value from -180,180 range into 0-360 range
    while (value < -180) {
      value += 360;
    }
    if (!degreeScaleHalf && value < 0) {
      value += 360;
    }

    if (degreeScaleHalf && value > 180) {
      value = -(360 - value);
    }

    if (value >= 0) {
      value = '00' + Math.round(value);
      value = value.substring(value.length, value.length - 3);
    } else {
      value = '00' + Math.abs(Math.round(value));
      value = '-' + value.substring(value.length, value.length - 3);
    }

    if (
      lcdColor === LcdColor.STANDARD ||
      lcdColor === LcdColor.STANDARD_GREEN
    ) {
      mainCtx.shadowColor = 'gray';
      mainCtx.shadowOffsetX = imageWidth * 0.007;
      mainCtx.shadowOffsetY = imageWidth * 0.007;
      mainCtx.shadowBlur = imageWidth * 0.007;
    }
    mainCtx.font = digitalFont ? lcdFont : stdFont;
    mainCtx.fillText(
      value + '\u00B0',
      imageWidth / 2 + lcdWidth * 0.05,
      (bLatest ? lcdPosY1 : lcdPosY2) + lcdHeight * 0.5 + lcdFontHeight * 0.38,
      lcdWidth * 0.9
    );

    mainCtx.restore();
  };

  const drawAreaSectionImage = function (ctx, start, stop, color, filled) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = imageWidth * 0.035;
    const startAngle = (angleRange / range) * start;
    const stopAngle = startAngle + (stop - start) / (range / angleRange);
    ctx.translate(centerX, centerY);
    ctx.rotate(rotationOffset);
    ctx.beginPath();
    if (filled) {
      ctx.moveTo(0, 0);
      ctx.arc(
        0,
        0,
        imageWidth * 0.365 - ctx.lineWidth / 2,
        startAngle,
        stopAngle,
        false
      );
    } else {
      ctx.arc(0, 0, imageWidth * 0.365, startAngle, stopAngle, false);
    }
    if (filled) {
      ctx.moveTo(0, 0);
      ctx.fill();
    } else {
      ctx.stroke();
    }

    ctx.translate(-centerX, -centerY);
    ctx.restore();
  };

  const drawTickmarksImage = function (ctx) {
    const OUTER_POINT = imageWidth * 0.38;
    const MAJOR_INNER_POINT = imageWidth * 0.35;
    // MED_INNER_POINT = imageWidth * 0.355,
    const MINOR_INNER_POINT = imageWidth * 0.36;
    const TEXT_WIDTH = imageWidth * 0.1;
    const TEXT_TRANSLATE_X = imageWidth * 0.31;
    const CARDINAL_TRANSLATE_X = imageWidth * 0.36;
    let stdFont;
    let smlFont;
    let i;
    let val;
    let to;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.save();
    ctx.strokeStyle = backgroundColor.labelColor.getRgbaColor();
    ctx.fillStyle = backgroundColor.labelColor.getRgbaColor();
    ctx.translate(centerX, centerY);

    if (!degreeScale) {
      stdFont = 0.12 * imageWidth + 'px serif';
      smlFont = 0.06 * imageWidth + 'px serif';

      // let angleStep = RAD_FACTOR;
      ctx.lineWidth = 1;
      ctx.strokeStyle = backgroundColor.symbolColor.getRgbaColor();

      for (i = 0; i < 360; i += 2.5) {
        if (i % 5 === 0) {
          ctx.beginPath();
          ctx.moveTo(imageWidth * 0.38, 0);
          ctx.lineTo(imageWidth * 0.36, 0);
          ctx.closePath();
          ctx.stroke();
        }

        // Draw the labels
        ctx.save();
        switch (i) {
          case 0: // E
            ctx.translate(imageWidth * 0.35, 0);
            ctx.rotate(HALF_PI);
            ctx.font = stdFont;
            ctx.fillText(pointSymbols[2], 0, 0);
            ctx.translate(-imageWidth * 0.35, 0);
            break
          case 45: // SE
            ctx.translate(imageWidth * 0.29, 0);
            ctx.rotate(HALF_PI);
            ctx.font = smlFont;
            ctx.fillText(pointSymbols[3], 0, 0);
            ctx.translate(-imageWidth * 0.29, 0);
            break
          case 90: // S
            ctx.translate(imageWidth * 0.35, 0);
            ctx.rotate(HALF_PI);
            ctx.font = stdFont;
            ctx.fillText(pointSymbols[4], 0, 0);
            ctx.translate(-imageWidth * 0.35, 0);
            break
          case 135: // SW
            ctx.translate(imageWidth * 0.29, 0);
            ctx.rotate(HALF_PI);
            ctx.font = smlFont;
            ctx.fillText(pointSymbols[5], 0, 0);
            ctx.translate(-imageWidth * 0.29, 0);
            break
          case 180: // W
            ctx.translate(imageWidth * 0.35, 0);
            ctx.rotate(HALF_PI);
            ctx.font = stdFont;
            ctx.fillText(pointSymbols[6], 0, 0);
            ctx.translate(-imageWidth * 0.35, 0);
            break
          case 225: // NW
            ctx.translate(imageWidth * 0.29, 0);
            ctx.rotate(HALF_PI);
            ctx.font = smlFont;
            ctx.fillText(pointSymbols[7], 0, 0);
            ctx.translate(-imageWidth * 0.29, 0);
            break
          case 270: // N
            ctx.translate(imageWidth * 0.35, 0);
            ctx.rotate(HALF_PI);
            ctx.font = stdFont;
            ctx.fillText(pointSymbols[0], 0, 0);
            ctx.translate(-imageWidth * 0.35, 0);
            break
          case 315: // NE
            ctx.translate(imageWidth * 0.29, 0);
            ctx.rotate(HALF_PI);
            ctx.font = smlFont;
            ctx.fillText(pointSymbols[1], 0, 0);
            ctx.translate(-imageWidth * 0.29, 0);
            break
        }
        ctx.restore();

        if (
          roseVisible &&
          (i === 0 ||
            i === 22.5 ||
            i === 45 ||
            i === 67.5 ||
            i === 90 ||
            i === 112.5 ||
            i === 135 ||
            i === 157.5 ||
            i === 180 ||
            i === 202.5 ||
            i === 225 ||
            i === 247.5 ||
            i === 270 ||
            i === 292.5 ||
            i === 315 ||
            i === 337.5 ||
            i === 360)
        ) {
          // ROSE_LINE
          ctx.save();
          ctx.beginPath();
          // indent the 16 half quadrant lines a bit for visual effect
          if (i % 45) {
            ctx.moveTo(imageWidth * 0.29, 0);
          } else {
            ctx.moveTo(imageWidth * 0.38, 0);
          }
          ctx.lineTo(imageWidth * 0.1, 0);
          ctx.closePath();
          ctx.restore();
          ctx.stroke();
        }
        ctx.rotate(angleStep * 2.5);
      }
    } else {
      stdFont = Math.floor(0.1 * imageWidth) + 'px serif bold';
      smlFont = Math.floor(imageWidth * 0.04) + 'px ' + stdFontName;

      ctx.rotate(angleStep * 5);
      for (i = 5; i <= 360; i += 5) {
        // Draw the labels
        ctx.save();
        if (pointSymbolsVisible) {
          switch (i) {
            case 360:
              ctx.translate(CARDINAL_TRANSLATE_X, 0);
              ctx.rotate(HALF_PI);
              ctx.font = stdFont;
              ctx.fillText(pointSymbols[2], 0, 0, TEXT_WIDTH);
              ctx.translate(-CARDINAL_TRANSLATE_X, 0);
              break
            case 90:
              ctx.translate(CARDINAL_TRANSLATE_X, 0);
              ctx.rotate(HALF_PI);
              ctx.font = stdFont;
              ctx.fillText(pointSymbols[4], 0, 0, TEXT_WIDTH);
              ctx.translate(-CARDINAL_TRANSLATE_X, 0);
              break
            case 180:
              ctx.translate(CARDINAL_TRANSLATE_X, 0);
              ctx.rotate(HALF_PI);
              ctx.font = stdFont;
              ctx.fillText(pointSymbols[6], 0, 0, TEXT_WIDTH);
              ctx.translate(-CARDINAL_TRANSLATE_X, 0);
              break
            case 270:
              ctx.translate(CARDINAL_TRANSLATE_X, 0);
              ctx.rotate(HALF_PI);
              ctx.font = stdFont;
              ctx.fillText(pointSymbols[0], 0, 0, TEXT_WIDTH);
              ctx.translate(-CARDINAL_TRANSLATE_X, 0);
              break

            case 5:
            case 85:
            case 95:
            case 175:
            case 185:
            case 265:
            case 275:
            case 355:
              // leave room for ordinal labels
              break

            default:
              if ((i + 90) % 20) {
                ctx.lineWidth = (i + 90) % 5 ? 1.5 : 1;
                ctx.beginPath();
                ctx.moveTo(OUTER_POINT, 0);
                to = (i + 90) % 10 ? MINOR_INNER_POINT : MAJOR_INNER_POINT;
                ctx.lineTo(to, 0);
                ctx.closePath();
                ctx.stroke();
              } else {
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(OUTER_POINT, 0);
                ctx.lineTo(MAJOR_INNER_POINT, 0);
                ctx.closePath();
                ctx.stroke();
                val = (i + 90) % 360;
                ctx.translate(TEXT_TRANSLATE_X, 0);
                ctx.rotate(HALF_PI);
                ctx.font = smlFont;
                ctx.fillText('0'.substring(val >= 100) + val, 0, 0, TEXT_WIDTH);
                ctx.translate(-TEXT_TRANSLATE_X, 0);
              }
          }
        } else {
          if ((i + 90) % 20) {
            ctx.lineWidth = (i + 90) % 5 ? 1.5 : 1;
            ctx.beginPath();
            ctx.moveTo(OUTER_POINT, 0);
            to = (i + 90) % 10 ? MINOR_INNER_POINT : MAJOR_INNER_POINT;
            ctx.lineTo(to, 0);
            ctx.closePath();
            ctx.stroke();
          } else {
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(OUTER_POINT, 0);
            ctx.lineTo(MAJOR_INNER_POINT, 0);
            ctx.closePath();
            ctx.stroke();
            val = (i + 90) % 360;
            if (degreeScaleHalf) {
              // invert 180-360
              if (val > 180) {
                val = -(360 - val);
              }
            }
            ctx.translate(TEXT_TRANSLATE_X, 0);
            ctx.rotate(HALF_PI);
            ctx.font = smlFont;
            ctx.fillText(val, 0, 0, TEXT_WIDTH);
            ctx.translate(-TEXT_TRANSLATE_X, 0);
          }
        }
        ctx.restore();
        ctx.rotate(angleStep * 5);
      }
    }
    ctx.translate(-centerX, -centerY);
    ctx.restore();
  };

  const drawLcdTitles = function (ctx) {
    if (lcdTitleStrings.length > 0) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = useColorLabels
        ? pointerColor.medium.getRgbaColor()
        : backgroundColor.labelColor.getRgbaColor();
      ctx.font = 0.04 * imageWidth + 'px ' + stdFontName;
      ctx.fillText(
        lcdTitleStrings[0],
        imageWidth / 2,
        imageHeight * 0.29,
        imageWidth * 0.3
      );
      ctx.fillStyle = useColorLabels
        ? pointerColorAverage.medium.getRgbaColor()
        : backgroundColor.labelColor.getRgbaColor();
      ctx.fillText(
        lcdTitleStrings[1],
        imageWidth / 2,
        imageHeight * 0.71,
        imageWidth * 0.3
      );
      if (titleString.length > 0) {
        ctx.fillStyle = backgroundColor.labelColor.getRgbaColor();
        ctx.font = 0.0467 * imageWidth + 'px ' + stdFontName;
        ctx.fillText(
          titleString,
          imageWidth / 2,
          imageHeight * 0.5,
          imageWidth * 0.3
        );
      }
    }
  };

  // **************   Initialization  ********************
  // Draw all static painting code to background

  const init = function (parameters) {
    parameters = parameters || {};
    const drawBackground2 =
      undefined === parameters.background ? false : parameters.background;
    const drawPointer =
      undefined === parameters.pointer ? false : parameters.pointer;
    const drawForeground2 =
      undefined === parameters.foreground ? false : parameters.foreground;

    initialized = true;

    if (drawBackground2 && frameVisible) {
      drawFrame(
        backgroundContext,
        frameDesign,
        centerX,
        centerY,
        imageWidth,
        imageHeight
      );
    }

    if (drawBackground2 && backgroundVisible) {
      // Create background in background buffer (backgroundBuffer)
      drawBackground(
        backgroundContext,
        backgroundColor,
        centerX,
        centerY,
        imageWidth,
        imageHeight
      );

      // Create custom layer in background buffer (backgroundBuffer)
      drawRadialCustomImage(
        backgroundContext,
        customLayer,
        centerX,
        centerY,
        imageWidth,
        imageHeight
      );

      // Create section in background buffer (backgroundBuffer)
      if (section !== null && section.length > 0) {
        let sectionIndex = section.length;
        do {
          sectionIndex--;
          drawAreaSectionImage(
            backgroundContext,
            section[sectionIndex].start,
            section[sectionIndex].stop,
            section[sectionIndex].color,
            false
          );
        } while (sectionIndex > 0)
      }

      // Create area in background buffer (backgroundBuffer)
      if (area !== null && area.length > 0) {
        let areaIndex = area.length;
        do {
          areaIndex--;
          drawAreaSectionImage(
            backgroundContext,
            area[areaIndex].start,
            area[areaIndex].stop,
            area[areaIndex].color,
            true
          );
        } while (areaIndex > 0)
      }

      drawTickmarksImage(backgroundContext);
    }

    if (drawBackground2 && roseVisible) {
      drawRoseImage(
        backgroundContext,
        centerX,
        centerY,
        imageWidth,
        imageHeight,
        backgroundColor
      );
    }

    // Create lcd background if selected in background buffer (backgroundBuffer)
    if (drawBackground2 && lcdVisible) {
      lcdBuffer = createLcdBackgroundImage(lcdWidth, lcdHeight, lcdColor);
      backgroundContext.drawImage(lcdBuffer, lcdPosX, lcdPosY1);
      backgroundContext.drawImage(lcdBuffer, lcdPosX, lcdPosY2);
      // Create title in background buffer (backgroundBuffer)
      drawLcdTitles(backgroundContext);
    }

    if (drawPointer) {
      drawPointerImage(
        pointerContextAverage,
        imageWidth,
        pointerTypeAverage,
        pointerColorAverage,
        backgroundColor.labelColor
      );
      drawPointerImage(
        pointerContextLatest,
        imageWidth,
        pointerTypeLatest,
        pointerColor,
        backgroundColor.labelColor
      );
    }

    if (drawForeground2 && foregroundVisible) {
      const knobVisible =
        !(pointerTypeLatest.type === 'type15' ||
        pointerTypeLatest.type === 'type16');
      drawForeground(
        foregroundContext,
        foregroundType,
        imageWidth,
        imageHeight,
        knobVisible,
        knobType,
        knobStyle
      );
    }
  };

  const repaint = function () {
    if (!initialized) {
      init({
        frame: true,
        background: true,
        led: true,
        pointer: true,
        foreground: true
      });
    }

    mainCtx.clearRect(0, 0, mainCtx.canvas.width, mainCtx.canvas.height);

    if (frameVisible || backgroundVisible) {
      mainCtx.drawImage(backgroundBuffer, 0, 0);
    }

    // Draw lcd display
    if (lcdVisible) {
      drawLcdText(valueLatest, true);
      drawLcdText(valueAverage, false);
    }

    // Define rotation angle
    angleAverage = valueAverage * angleStep;

    // we have to draw to a rotated temporary image area so we can translate in
    // absolute x, y values when drawing to main context
    const shadowOffset = imageWidth * 0.006;

    // Define rotation center
    mainCtx.save();
    mainCtx.translate(centerX, centerY);
    mainCtx.rotate(angleAverage);
    mainCtx.translate(-centerX, -centerY);
    // Set the pointer shadow params
    mainCtx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    mainCtx.shadowOffsetX = mainCtx.shadowOffsetY = shadowOffset;
    mainCtx.shadowBlur = shadowOffset * 2;
    // Draw the pointer
    mainCtx.drawImage(pointerBufferAverage, 0, 0);
    // Define rotation angle difference for average pointer
    angleLatest = valueLatest * angleStep - angleAverage;
    mainCtx.translate(centerX, centerY);
    mainCtx.rotate(angleLatest);
    mainCtx.translate(-centerX, -centerY);
    mainCtx.drawImage(pointerBufferLatest, 0, 0);
    mainCtx.restore();

    if (foregroundVisible) {
      mainCtx.drawImage(foregroundBuffer, 0, 0);
    }
  };

  // Visualize the component
  repaint();
}

class WindDirectionElement extends BaseElement {
  static get drawFunction () { return drawWindDirection }

  static get properties () {
    return {
      size: { type: Number, defaultValue: 200 },
      valueLatest: { type: Number, defaultValue: 0 },
      valueAverage: { type: Number, defaultValue: 0 },
      real_valueLatest: { state: true },
      real_valueAverage: { state: true },
      transitionTime: { type: Number, defaultValue: 500 },
      frameDesign: { type: String, objectEnum: FrameDesign, defaultValue: 'METAL' },
      noFrameVisible: { type: Boolean, defaultValue: false },
      backgroundColor: { type: String, objectEnum: BackgroundColor, defaultValue: 'DARK_GRAY' },
      noBackgroundVisible: { type: Boolean, defaultValue: false },
      pointerTypeLatest: { type: String, objectEnum: PointerType, defaultValue: 'TYPE1' },
      pointerTypeAverage: { type: String, objectEnum: PointerType, defaultValue: 'TYPE8' },
      pointerColor: { type: String, objectEnum: Color$1, defaultValue: 'RED' },
      pointerColorAverage: { type: String, objectEnum: Color$1, defaultValue: 'BLUE' },
      knobType: { type: String, objectEnum: KnobType, defaultValue: 'STANDARD_KNOB' },
      knobStyle: { type: String, objectEnum: KnobStyle, defaultValue: 'SILVER' },
      foregroundType: { type: String, objectEnum: ForegroundType, defaultValue: 'TYPE1' },
      noForegroundVisible: { type: Boolean, defaultValue: false },
      pointSymbols: { type: Array, defaultValue: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] },
      noPointSymbolsVisible: { type: Boolean, defaultValue: false },
      noDegreeScale: { type: Boolean, defaultValue: false },
      degreeScaleHalf: { type: Boolean, defaultValue: false },
      roseVisible: { type: Boolean, defaultValue: false },
      lcdColor: { type: String, objectEnum: LcdColor, defaultValue: 'STANDARD' },
      noLcdVisible: { type: Boolean, defaultValue: false },
      digitalFont: { type: Boolean, defaultValue: false },
      lcdTitleStrings: { type: Array, defaultValue: ['Latest', 'Average'] },
      titleString: { type: String, defaultValue: '' },
      useColorLabels: { type: Boolean, defaultValue: false }
    }
  }

  constructor () {
    super();
    this._timer = timer(() => {});
    this._timer.stop();
  }

  connectedCallback () {
    super.connectedCallback();
    this.real_valueLatest = this.real_valueLatest ?? 0;
    this.real_valueAverage = this.real_valueAverage ?? 0;
  }

  render () {
    return $`
      <canvas width="${this.size}" height="${this.size}"></canvas>
    `
  }

  updated (changedProperties) {
    super.updated();
    if (changedProperties.has('valueLatest') ||
    changedProperties.has('valueAverage') ||
    changedProperties.has('transitionTime')) {
      const transitionTime = this.transitionTime;
      const originTime = now();
      const originValueLatest = this.real_valueLatest;
      const targetValueLatest = this.valueLatest;
      const originValueAverage = this.real_valueAverage;
      const targetValueAverage = this.valueAverage;
      const timeScale = transitionTime <= 0 ? () => 1 : linear().domain([0, transitionTime]).clamp(true);
      const valueLatestScale = linear().range([originValueLatest, targetValueLatest]).clamp(true);
      const valueAverageScale = linear().range([originValueAverage, targetValueAverage]).clamp(true);
      this._timer.restart((elapsedTime) => {
        const scaled = timeScale(elapsedTime);
        const eased = cubicInOut(scaled);
        this.real_valueLatest = valueLatestScale(eased);
        this.real_valueAverage = valueAverageScale(eased);
        if (now() >= originTime + transitionTime) {
          this._timer.stop();
        }
      });
    }
  }
}

window.customElements.define('steelseries-wind-direction', WindDirectionElement);

function drawHorizon (canvas, parameters) {
  parameters = parameters || {};
  let size = undefined === parameters.size ? 0 : parameters.size;
  const frameDesign =
    undefined === parameters.frameDesign
      ? FrameDesign.METAL
      : parameters.frameDesign;
  const frameVisible =
    undefined === parameters.frameVisible ? true : parameters.frameVisible;
  const foregroundType =
    undefined === parameters.foregroundType
      ? ForegroundType.TYPE1
      : parameters.foregroundType;
  const foregroundVisible =
    undefined === parameters.foregroundVisible
      ? true
      : parameters.foregroundVisible;
  const pointerColor =
    undefined === parameters.pointerColor
      ? Color$1.WHITE
      : parameters.pointerColor;

  const roll = parameters.roll ?? 0;
  const pitch = parameters.pitch ?? 0;
  const pitchPixel = (PI * size) / 360;

  // Get the canvas context and clear it
  const mainCtx = getCanvasContext(canvas);
  // Has a size been specified?
  if (size === 0) {
    size = Math.min(mainCtx.canvas.width, mainCtx.canvas.height);
  }

  // Set the size - also clears the canvas
  mainCtx.canvas.width = size;
  mainCtx.canvas.height = size;

  const imageWidth = size;
  const imageHeight = size;

  const centerX = imageWidth / 2;
  const centerY = imageHeight / 2;

  let initialized = false;

  // **************   Buffer creation  ********************
  // Buffer for all static background painting code
  const backgroundBuffer = createBuffer(size, size);
  const backgroundContext = backgroundBuffer.getContext('2d');

  // Buffer for pointer image painting code
  const valueBuffer = createBuffer(size, size * PI);
  const valueContext = valueBuffer.getContext('2d');

  // Buffer for indicator painting code
  const indicatorBuffer = createBuffer(size * 0.037383, size * 0.056074);
  const indicatorContext = indicatorBuffer.getContext('2d');

  // Buffer for static foreground painting code
  const foregroundBuffer = createBuffer(size, size);
  const foregroundContext = foregroundBuffer.getContext('2d');

  // **************   Image creation  ********************
  const drawHorizonBackgroundImage = function (ctx) {
    ctx.save();

    const imgWidth = size;
    const imgHeight = size * PI;
    let y;

    // HORIZON
    ctx.beginPath();
    ctx.rect(0, 0, imgWidth, imgHeight);
    ctx.closePath();
    const HORIZON_GRADIENT = ctx.createLinearGradient(0, 0, 0, imgHeight);
    HORIZON_GRADIENT.addColorStop(0, '#7fd5f0');
    HORIZON_GRADIENT.addColorStop(0.5, '#7fd5f0');
    HORIZON_GRADIENT.addColorStop(0.5, '#3c4439');
    HORIZON_GRADIENT.addColorStop(1, '#3c4439');
    ctx.fillStyle = HORIZON_GRADIENT;
    ctx.fill();

    ctx.lineWidth = 1;
    const stepSizeY = (imgHeight / 360) * 5;
    let stepTen = false;
    let step = 10;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fontSize = imgWidth * 0.04;
    ctx.font = fontSize + 'px ' + stdFontName;
    ctx.fillStyle = '#37596e';
    for (y = imgHeight / 2 - stepSizeY; y > 0; y -= stepSizeY) {
      if (step <= 90) {
        if (stepTen) {
          ctx.fillText(
            step,
            (imgWidth - imgWidth * 0.2) / 2 - 8,
            y,
            imgWidth * 0.375
          );
          ctx.fillText(
            step,
            imgWidth - (imgWidth - imgWidth * 0.2) / 2 + 8,
            y,
            imgWidth * 0.375
          );
          ctx.beginPath();
          ctx.moveTo((imgWidth - imgWidth * 0.2) / 2, y);
          ctx.lineTo(imgWidth - (imgWidth - imgWidth * 0.2) / 2, y);
          ctx.closePath();
          step += 10;
        } else {
          ctx.beginPath();
          ctx.moveTo((imgWidth - imgWidth * 0.1) / 2, y);
          ctx.lineTo(imgWidth - (imgWidth - imgWidth * 0.1) / 2, y);
          ctx.closePath();
        }
        ctx.stroke();
      }
      stepTen ^= true;
    }
    stepTen = false;
    step = 10;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, imgHeight / 2);
    ctx.lineTo(imgWidth, imgHeight / 2);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    for (y = imgHeight / 2 + stepSizeY; y <= imgHeight; y += stepSizeY) {
      if (step <= 90) {
        if (stepTen) {
          ctx.fillText(
            -step,
            (imgWidth - imgWidth * 0.2) / 2 - 8,
            y,
            imgWidth * 0.375
          );
          ctx.fillText(
            -step,
            imgWidth - (imgWidth - imgWidth * 0.2) / 2 + 8,
            y,
            imgWidth * 0.375
          );
          ctx.beginPath();
          ctx.moveTo((imgWidth - imgWidth * 0.2) / 2, y);
          ctx.lineTo(imgWidth - (imgWidth - imgWidth * 0.2) / 2, y);
          ctx.closePath();
          step += 10;
        } else {
          ctx.beginPath();
          ctx.moveTo((imgWidth - imgWidth * 0.1) / 2, y);
          ctx.lineTo(imgWidth - (imgWidth - imgWidth * 0.1) / 2, y);
          ctx.closePath();
        }
        ctx.stroke();
      }
      stepTen ^= true;
    }

    ctx.restore();
  };

  const drawHorizonForegroundImage = function (ctx) {
    ctx.save();

    ctx.fillStyle = pointerColor.light.getRgbaColor();

    // CENTERINDICATOR
    ctx.beginPath();
    ctx.moveTo(imageWidth * 0.476635, imageHeight * 0.5);
    ctx.bezierCurveTo(
      imageWidth * 0.476635,
      imageHeight * 0.514018,
      imageWidth * 0.485981,
      imageHeight * 0.523364,
      imageWidth * 0.5,
      imageHeight * 0.523364
    );
    ctx.bezierCurveTo(
      imageWidth * 0.514018,
      imageHeight * 0.523364,
      imageWidth * 0.523364,
      imageHeight * 0.514018,
      imageWidth * 0.523364,
      imageHeight * 0.5
    );
    ctx.bezierCurveTo(
      imageWidth * 0.523364,
      imageHeight * 0.485981,
      imageWidth * 0.514018,
      imageHeight * 0.476635,
      imageWidth * 0.5,
      imageHeight * 0.476635
    );
    ctx.bezierCurveTo(
      imageWidth * 0.485981,
      imageHeight * 0.476635,
      imageWidth * 0.476635,
      imageHeight * 0.485981,
      imageWidth * 0.476635,
      imageHeight * 0.5
    );
    ctx.closePath();
    ctx.moveTo(imageWidth * 0.415887, imageHeight * 0.504672);
    ctx.lineTo(imageWidth * 0.415887, imageHeight * 0.495327);
    ctx.bezierCurveTo(
      imageWidth * 0.415887,
      imageHeight * 0.495327,
      imageWidth * 0.467289,
      imageHeight * 0.495327,
      imageWidth * 0.467289,
      imageHeight * 0.495327
    );
    ctx.bezierCurveTo(
      imageWidth * 0.471962,
      imageHeight * 0.481308,
      imageWidth * 0.481308,
      imageHeight * 0.471962,
      imageWidth * 0.495327,
      imageHeight * 0.467289
    );
    ctx.bezierCurveTo(
      imageWidth * 0.495327,
      imageHeight * 0.467289,
      imageWidth * 0.495327,
      imageHeight * 0.415887,
      imageWidth * 0.495327,
      imageHeight * 0.415887
    );
    ctx.lineTo(imageWidth * 0.504672, imageHeight * 0.415887);
    ctx.bezierCurveTo(
      imageWidth * 0.504672,
      imageHeight * 0.415887,
      imageWidth * 0.504672,
      imageHeight * 0.467289,
      imageWidth * 0.504672,
      imageHeight * 0.467289
    );
    ctx.bezierCurveTo(
      imageWidth * 0.518691,
      imageHeight * 0.471962,
      imageWidth * 0.528037,
      imageHeight * 0.481308,
      imageWidth * 0.53271,
      imageHeight * 0.495327
    );
    ctx.bezierCurveTo(
      imageWidth * 0.53271,
      imageHeight * 0.495327,
      imageWidth * 0.584112,
      imageHeight * 0.495327,
      imageWidth * 0.584112,
      imageHeight * 0.495327
    );
    ctx.lineTo(imageWidth * 0.584112, imageHeight * 0.504672);
    ctx.bezierCurveTo(
      imageWidth * 0.584112,
      imageHeight * 0.504672,
      imageWidth * 0.53271,
      imageHeight * 0.504672,
      imageWidth * 0.53271,
      imageHeight * 0.504672
    );
    ctx.bezierCurveTo(
      imageWidth * 0.528037,
      imageHeight * 0.518691,
      imageWidth * 0.518691,
      imageHeight * 0.53271,
      imageWidth * 0.5,
      imageHeight * 0.53271
    );
    ctx.bezierCurveTo(
      imageWidth * 0.481308,
      imageHeight * 0.53271,
      imageWidth * 0.471962,
      imageHeight * 0.518691,
      imageWidth * 0.467289,
      imageHeight * 0.504672
    );
    ctx.bezierCurveTo(
      imageWidth * 0.467289,
      imageHeight * 0.504672,
      imageWidth * 0.415887,
      imageHeight * 0.504672,
      imageWidth * 0.415887,
      imageHeight * 0.504672
    );
    ctx.closePath();
    ctx.fill();

    // Tickmarks
    const step = 5;
    const stepRad = 5 * RAD_FACTOR;
    ctx.translate(centerX, centerY);
    ctx.rotate(-HALF_PI);
    ctx.translate(-centerX, -centerY);
    let angle;
    for (angle = -90; angle <= 90; angle += step) {
      if (angle % 45 === 0 || angle === 0) {
        ctx.strokeStyle = pointerColor.medium.getRgbaColor();
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(imageWidth * 0.5, imageHeight * 0.088785);
        ctx.lineTo(imageWidth * 0.5, imageHeight * 0.113);
        ctx.closePath();
        ctx.stroke();
      } else if (angle % 15 === 0) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(imageWidth * 0.5, imageHeight * 0.088785);
        ctx.lineTo(imageWidth * 0.5, imageHeight * 0.103785);
        ctx.closePath();
        ctx.stroke();
      } else {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(imageWidth * 0.5, imageHeight * 0.088785);
        ctx.lineTo(imageWidth * 0.5, imageHeight * 0.093785);
        ctx.closePath();
        ctx.stroke();
      }
      ctx.translate(centerX, centerY);
      ctx.rotate(stepRad, centerX, centerY);
      ctx.translate(-centerX, -centerY);
    }

    ctx.restore();
  };

  const drawIndicatorImage = function (ctx) {
    ctx.save();

    const imgWidth = imageWidth * 0.037383;
    const imgHeight = imageHeight * 0.056074;

    ctx.beginPath();
    ctx.moveTo(imgWidth * 0.5, 0);
    ctx.lineTo(0, imgHeight);
    ctx.lineTo(imgWidth, imgHeight);
    ctx.closePath();

    ctx.fillStyle = pointerColor.light.getRgbaColor();
    ctx.fill();
    ctx.strokeStyle = pointerColor.medium.getRgbaColor();
    ctx.stroke();

    ctx.restore();
  };

  // **************   Initialization  ********************
  // Draw all static painting code to background
  const init = function () {
    initialized = true;

    if (frameVisible) {
      drawFrame(
        backgroundContext,
        frameDesign,
        centerX,
        centerY,
        imageWidth,
        imageHeight
      );
    }

    drawHorizonBackgroundImage(valueContext);

    drawIndicatorImage(indicatorContext);

    drawHorizonForegroundImage(foregroundContext);

    if (foregroundVisible) {
      drawForeground(
        foregroundContext,
        foregroundType,
        imageWidth,
        imageHeight,
        true,
        KnobType,
        KnobStyle,
        GaugeType
      );
    }
  };

  const repaint = function () {
    if (!initialized) {
      init();
    }

    mainCtx.save();
    mainCtx.clearRect(0, 0, mainCtx.canvas.width, mainCtx.canvas.height);

    mainCtx.drawImage(backgroundBuffer, 0, 0);

    mainCtx.save();

    // Set the clipping area
    mainCtx.beginPath();
    mainCtx.arc(centerX, centerY, (imageWidth * 0.831775) / 2, 0, TWO_PI, true);
    mainCtx.closePath();
    mainCtx.clip();

    // Rotate around roll
    mainCtx.translate(centerX, centerY);
    mainCtx.rotate(-(roll * RAD_FACTOR));
    mainCtx.translate(-centerX, 0);
    // Translate about dive
    mainCtx.translate(0, pitch * pitchPixel);

    // Draw horizon
    mainCtx.drawImage(valueBuffer, 0, -valueBuffer.height / 2);

    // Draw the scale and angle indicator
    mainCtx.translate(0, -(pitch * pitchPixel) - centerY);
    mainCtx.drawImage(
      indicatorBuffer,
      imageWidth * 0.5 - indicatorBuffer.width / 2,
      imageWidth * 0.107476
    );
    mainCtx.restore();

    mainCtx.drawImage(foregroundBuffer, 0, 0);

    mainCtx.restore();
  };

  // Visualize the component
  repaint();
}

class HorizonElement extends BaseElement {
  static get drawFunction () { return drawHorizon }

  static get properties () {
    return {
      size: { type: Number, defaultValue: 200 },
      roll: { type: Number, defaultValue: 0 },
      pitch: { type: Number, defaultValue: 0 },
      real_roll: { state: true },
      real_pitch: { state: true },
      transitionTime: { type: Number, defaultValue: 500 },
      frameDesign: { type: String, objectEnum: FrameDesign, defaultValue: 'METAL' },
      noFrameVisible: { type: Boolean, defaultValue: false },
      foregroundType: { type: String, objectEnum: ForegroundType, defaultValue: 'TYPE1' },
      noForegroundVisible: { type: Boolean, defaultValue: false },
      pointerColor: { type: String, objectEnum: Color$1, defaultValue: 'GRAY' }
    }
  }

  constructor () {
    super();
    this._timer = timer(() => {});
    this._timer.stop();
  }

  connectedCallback () {
    super.connectedCallback();
    this.real_roll = this.real_roll ?? 0;
    this.real_pitch = this.real_pitch ?? 0;
  }

  render () {
    return $`
      <canvas width="${this.size}" height="${this.size}"></canvas>
    `
  }

  updated (changedProperties) {
    super.updated();
    if (changedProperties.has('roll') ||
    changedProperties.has('pitch') ||
    changedProperties.has('transitionTime')) {
      const transitionTime = this.transitionTime;
      const originTime = now();
      const originRoll = this.real_roll;
      const targetRoll = this.roll;
      const originPitch = this.real_pitch;
      const targetPitch = this.pitch;
      const timeScale = transitionTime <= 0 ? () => 1 : linear().domain([0, transitionTime]).clamp(true);
      const rollScale = linear().range([originRoll, targetRoll]).clamp(true);
      const pitchScale = linear().range([originPitch, targetPitch]).clamp(true);
      this._timer.restart((elapsedTime) => {
        const scaled = timeScale(elapsedTime);
        const eased = cubicInOut(scaled);
        const newRoll = rollScale(eased);
        const newPitch = pitchScale(eased);
        this.real_roll = newRoll;
        this.real_pitch = newPitch;
        if (now() >= originTime + transitionTime) {
          this._timer.stop();
        }
      });
    }
  }
}

window.customElements.define('steelseries-horizon', HorizonElement);

function drawLed (canvas, parameters) {
  parameters = parameters || {};
  let size = undefined === parameters.size ? 0 : parameters.size;
  const ledColor =
    undefined === parameters.ledColor ? LedColor.RED_LED : parameters.ledColor;

  // Get the canvas context and clear it
  const mainCtx = getCanvasContext(canvas);
  // Has a size been specified?
  if (size === 0) {
    size = Math.min(mainCtx.canvas.width, mainCtx.canvas.height);
  }

  // Set the size - also clears the canvas
  mainCtx.canvas.width = size;
  mainCtx.canvas.height = size;

  let initialized = false;

  // Buffer for led on painting code
  const ledBufferOn = doc.createElement('canvas');
  ledBufferOn.width = size;
  ledBufferOn.height = size;
  const ledContextOn = ledBufferOn.getContext('2d');

  // Buffer for led off painting code
  const ledBufferOff = doc.createElement('canvas');
  ledBufferOff.width = size;
  ledBufferOff.height = size;
  const ledContextOff = ledBufferOff.getContext('2d');

  // Buffer for current led painting code
  const ledBuffer = parameters.ledOn ?? false ? ledBufferOn : ledBufferOff;

  const init = function () {
    initialized = true;

    // Draw LED ON in ledBuffer_ON
    ledContextOn.clearRect(
      0,
      0,
      ledContextOn.canvas.width,
      ledContextOn.canvas.height
    );
    ledContextOn.drawImage(createLedImage(size, 1, ledColor), 0, 0);

    // Draw LED ON in ledBuffer_OFF
    ledContextOff.clearRect(
      0,
      0,
      ledContextOff.canvas.width,
      ledContextOff.canvas.height
    );
    ledContextOff.drawImage(createLedImage(size, 0, ledColor), 0, 0);
  };

  const repaint = function () {
    if (!initialized) {
      init();
    }

    mainCtx.save();
    mainCtx.clearRect(0, 0, mainCtx.canvas.width, mainCtx.canvas.height);

    mainCtx.drawImage(ledBuffer, 0, 0);

    mainCtx.restore();
  };

  repaint();
}

class LedElement extends BaseElement {
  static get drawFunction () { return drawLed }

  static get properties () {
    return {
      size: { type: Number, defaultValue: 50 },
      ledOn: { type: Boolean, defaultValue: false },
      ledColor: { type: String, objectEnum: LedColor, defaultValue: 'RED_LED' }
    }
  }

  render () {
    return $`
      <canvas width="${this.size}" height="${this.size}"></canvas>
    `
  }
}

window.customElements.define('steelseries-led', LedElement);

function drawClock (canvas, parameters) {
  parameters = parameters || {};
  let size = undefined === parameters.size ? 0 : parameters.size;
  const frameDesign =
    undefined === parameters.frameDesign
      ? FrameDesign.METAL
      : parameters.frameDesign;
  const frameVisible =
    undefined === parameters.frameVisible ? true : parameters.frameVisible;
  const pointerType =
    undefined === parameters.pointerType
      ? PointerType.TYPE1
      : parameters.pointerType;
  const pointerColor =
    undefined === parameters.pointerColor
      ? pointerType === PointerType.TYPE1
        ? Color$1.GRAY
        : Color$1.BLACK
      : parameters.pointerColor;
  const backgroundColor =
    undefined === parameters.backgroundColor
      ? pointerType === PointerType.TYPE1
        ? BackgroundColor.ANTHRACITE
        : BackgroundColor.LIGHT_GRAY
      : parameters.backgroundColor;
  const backgroundVisible =
    undefined === parameters.backgroundVisible
      ? true
      : parameters.backgroundVisible;
  const foregroundType =
    undefined === parameters.foregroundType
      ? ForegroundType.TYPE1
      : parameters.foregroundType;
  const foregroundVisible =
    undefined === parameters.foregroundVisible
      ? true
      : parameters.foregroundVisible;
  const customLayer =
    undefined === parameters.customLayer ? null : parameters.customLayer;
  let hour = undefined === parameters.hour ? 11 : parameters.hour;
  let minute = undefined === parameters.minute ? 5 : parameters.minute;
  let second = undefined === parameters.second ? 0 : parameters.second;
  const secondMovesContinuous =
    undefined === parameters.secondMovesContinuous
      ? false
      : parameters.secondMovesContinuous;
  const timeZoneOffsetHour =
    undefined === parameters.timeZoneOffsetHour
      ? 0
      : parameters.timeZoneOffsetHour;
  const timeZoneOffsetMinute =
    undefined === parameters.timeZoneOffsetMinute
      ? 0
      : parameters.timeZoneOffsetMinute;
  const secondPointerVisible =
    undefined === parameters.secondPointerVisible
      ? true
      : parameters.secondPointerVisible;

  // GaugeType specific private variables
  const objDate = new Date();
  let minutePointerAngle;
  let hourPointerAngle;
  let secondPointerAngle;

  // Constants
  const ANGLE_STEP = 6;

  // Get the canvas context and clear it
  const mainCtx = getCanvasContext(canvas);
  // Has a size been specified?
  if (size === 0) {
    size = Math.min(mainCtx.canvas.width, mainCtx.canvas.height);
  }

  // Set the size - also clears the canvas
  mainCtx.canvas.width = size;
  mainCtx.canvas.height = size;

  const imageWidth = size;
  const imageHeight = size;

  const centerX = imageWidth / 2;
  const centerY = imageHeight / 2;

  let initialized = false;

  // Buffer for the frame
  const frameBuffer = createBuffer(size, size);
  const frameContext = frameBuffer.getContext('2d');

  // Buffer for static background painting code
  const backgroundBuffer = createBuffer(size, size);
  const backgroundContext = backgroundBuffer.getContext('2d');

  // Buffer for hour pointer image painting code
  const hourBuffer = createBuffer(size, size);
  const hourContext = hourBuffer.getContext('2d');

  // Buffer for minute pointer image painting code
  const minuteBuffer = createBuffer(size, size);
  const minuteContext = minuteBuffer.getContext('2d');

  // Buffer for second pointer image painting code
  const secondBuffer = createBuffer(size, size);
  const secondContext = secondBuffer.getContext('2d');

  // Buffer for static foreground painting code
  const foregroundBuffer = createBuffer(size, size);
  const foregroundContext = foregroundBuffer.getContext('2d');

  const drawTickmarksImage = function (ctx, ptrType) {
    let tickAngle;
    let SMALL_TICK_HEIGHT;
    let BIG_TICK_HEIGHT;
    let INNER_POINT;
    const OUTER_POINT = imageWidth * 0.405;
    ctx.save();
    ctx.translate(centerX, centerY);

    switch (ptrType.type) {
      case 'type1':
        // Draw minutes tickmarks
        SMALL_TICK_HEIGHT = imageWidth * 0.074766;
        INNER_POINT = OUTER_POINT - SMALL_TICK_HEIGHT;
        ctx.strokeStyle = backgroundColor.labelColor.getRgbaColor();
        ctx.lineWidth = imageWidth * 0.014018;

        for (tickAngle = 0; tickAngle < 360; tickAngle += 30) {
          ctx.beginPath();
          ctx.moveTo(OUTER_POINT, 0);
          ctx.lineTo(INNER_POINT, 0);
          ctx.closePath();
          ctx.stroke();
          ctx.rotate(30 * RAD_FACTOR);
        }

        // Draw hours tickmarks
        BIG_TICK_HEIGHT = imageWidth * 0.126168;
        INNER_POINT = OUTER_POINT - BIG_TICK_HEIGHT;
        ctx.lineWidth = imageWidth * 0.03271;

        for (tickAngle = 0; tickAngle < 360; tickAngle += 90) {
          ctx.beginPath();
          ctx.moveTo(OUTER_POINT, 0);
          ctx.lineTo(INNER_POINT, 0);
          ctx.closePath();
          ctx.stroke();
          ctx.rotate(90 * RAD_FACTOR);
        }
        break

      case 'type2':
      /* falls through */
      default:
        // Draw minutes tickmarks
        SMALL_TICK_HEIGHT = imageWidth * 0.037383;
        INNER_POINT = OUTER_POINT - SMALL_TICK_HEIGHT;
        ctx.strokeStyle = backgroundColor.labelColor.getRgbaColor();
        ctx.lineWidth = imageWidth * 0.009345;

        for (tickAngle = 0; tickAngle < 360; tickAngle += 6) {
          ctx.beginPath();
          ctx.moveTo(OUTER_POINT, 0);
          ctx.lineTo(INNER_POINT, 0);
          ctx.closePath();
          ctx.stroke();
          ctx.rotate(6 * RAD_FACTOR);
        }

        // Draw hours tickmarks
        BIG_TICK_HEIGHT = imageWidth * 0.084112;
        INNER_POINT = OUTER_POINT - BIG_TICK_HEIGHT;
        ctx.lineWidth = imageWidth * 0.028037;

        for (tickAngle = 0; tickAngle < 360; tickAngle += 30) {
          ctx.beginPath();
          ctx.moveTo(OUTER_POINT, 0);
          ctx.lineTo(INNER_POINT, 0);
          ctx.closePath();
          ctx.stroke();
          ctx.rotate(30 * RAD_FACTOR);
        }
        break
    }
    ctx.translate(-centerX, -centerY);
    ctx.restore();
  };

  const drawHourPointer = function (ctx, ptrType) {
    ctx.save();
    let grad;

    switch (ptrType.type) {
      case 'type2':
        ctx.beginPath();
        ctx.lineWidth = imageWidth * 0.046728;
        ctx.moveTo(centerX, imageWidth * 0.289719);
        ctx.lineTo(centerX, imageWidth * 0.289719 + imageWidth * 0.224299);
        ctx.strokeStyle = pointerColor.medium.getRgbaColor();
        ctx.closePath();
        ctx.stroke();
        break

      case 'type1':
      /* falls through */
      default:
        ctx.beginPath();
        ctx.moveTo(imageWidth * 0.471962, imageHeight * 0.560747);
        ctx.lineTo(imageWidth * 0.471962, imageHeight * 0.214953);
        ctx.lineTo(imageWidth * 0.5, imageHeight * 0.182242);
        ctx.lineTo(imageWidth * 0.528037, imageHeight * 0.214953);
        ctx.lineTo(imageWidth * 0.528037, imageHeight * 0.560747);
        ctx.lineTo(imageWidth * 0.471962, imageHeight * 0.560747);
        ctx.closePath();
        grad = ctx.createLinearGradient(
          imageWidth * 0.471962,
          imageHeight * 0.560747,
          imageWidth * 0.528037,
          imageHeight * 0.214953
        );
        grad.addColorStop(1, pointerColor.veryLight.getRgbaColor());
        grad.addColorStop(0, pointerColor.light.getRgbaColor());
        ctx.fillStyle = grad;
        ctx.strokeStyle = pointerColor.light.getRgbaColor();
        ctx.fill();
        ctx.stroke();
        break
    }
    ctx.restore();
  };

  const drawMinutePointer = function (ctx, ptrType) {
    ctx.save();
    let grad;

    switch (ptrType.type) {
      case 'type2':
        ctx.beginPath();
        ctx.lineWidth = imageWidth * 0.03271;
        ctx.moveTo(centerX, imageWidth * 0.116822);
        ctx.lineTo(centerX, imageWidth * 0.116822 + imageWidth * 0.38785);
        ctx.strokeStyle = pointerColor.medium.getRgbaColor();
        ctx.closePath();
        ctx.stroke();
        break

      case 'type1':
      /* falls through */
      default:
        ctx.beginPath();
        ctx.moveTo(imageWidth * 0.518691, imageHeight * 0.574766);
        ctx.lineTo(imageWidth * 0.523364, imageHeight * 0.135514);
        ctx.lineTo(imageWidth * 0.5, imageHeight * 0.107476);
        ctx.lineTo(imageWidth * 0.476635, imageHeight * 0.140186);
        ctx.lineTo(imageWidth * 0.476635, imageHeight * 0.574766);
        ctx.lineTo(imageWidth * 0.518691, imageHeight * 0.574766);
        ctx.closePath();
        grad = ctx.createLinearGradient(
          imageWidth * 0.518691,
          imageHeight * 0.574766,
          imageWidth * 0.476635,
          imageHeight * 0.140186
        );
        grad.addColorStop(1, pointerColor.veryLight.getRgbaColor());
        grad.addColorStop(0, pointerColor.light.getRgbaColor());
        ctx.fillStyle = grad;
        ctx.strokeStyle = pointerColor.light.getRgbaColor();
        ctx.fill();
        ctx.stroke();
        break
    }
    ctx.restore();
  };

  const drawSecondPointer = function (ctx, ptrType) {
    ctx.save();
    let grad;

    switch (ptrType.type) {
      case 'type2':
        // top rectangle
        ctx.lineWidth = imageWidth * 0.009345;
        ctx.beginPath();
        ctx.moveTo(centerX, imageWidth * 0.09813);
        ctx.lineTo(centerX, imageWidth * 0.09813 + imageWidth * 0.126168);
        ctx.closePath();
        ctx.stroke();
        // bottom rectangle
        ctx.lineWidth = imageWidth * 0.018691;
        ctx.beginPath();
        ctx.moveTo(centerX, imageWidth * 0.308411);
        ctx.lineTo(centerX, imageWidth * 0.308411 + imageWidth * 0.191588);
        ctx.closePath();
        ctx.stroke();
        // circle
        ctx.lineWidth = imageWidth * 0.016;
        ctx.beginPath();
        ctx.arc(
          centerX,
          imageWidth * 0.26,
          (imageWidth * 0.085) / 2,
          0,
          TWO_PI
        );
        ctx.closePath();
        ctx.stroke();
        break

      case 'type1':
      /* falls through */
      default:
        ctx.beginPath();
        ctx.moveTo(imageWidth * 0.509345, imageHeight * 0.116822);
        ctx.lineTo(imageWidth * 0.509345, imageHeight * 0.574766);
        ctx.lineTo(imageWidth * 0.490654, imageHeight * 0.574766);
        ctx.lineTo(imageWidth * 0.490654, imageHeight * 0.116822);
        ctx.lineTo(imageWidth * 0.509345, imageHeight * 0.116822);
        ctx.closePath();
        grad = ctx.createLinearGradient(
          imageWidth * 0.509345,
          imageHeight * 0.116822,
          imageWidth * 0.490654,
          imageHeight * 0.574766
        );
        grad.addColorStop(0, Color$1.RED.light.getRgbaColor());
        grad.addColorStop(0.47, Color$1.RED.medium.getRgbaColor());
        grad.addColorStop(1, Color$1.RED.dark.getRgbaColor());
        ctx.fillStyle = grad;
        ctx.strokeStyle = Color$1.RED.dark.getRgbaColor();
        ctx.fill();
        ctx.stroke();
        break
    }
    ctx.restore();
  };

  const drawKnob = function (ctx) {
    // draw the knob
    ctx.beginPath();
    ctx.arc(centerX, centerY, imageWidth * 0.045, 0, TWO_PI);
    ctx.closePath();
    const grad = ctx.createLinearGradient(
      centerX - (imageWidth * 0.045) / 2,
      centerY - (imageWidth * 0.045) / 2,
      centerX + (imageWidth * 0.045) / 2,
      centerY + (imageWidth * 0.045) / 2
    );
    grad.addColorStop(0, '#eef0f2');
    grad.addColorStop(1, '#65696d');
    ctx.fillStyle = grad;
    ctx.fill();
  };

  const drawTopKnob = function (ctx, ptrType) {
    let grad;

    ctx.save();

    switch (ptrType.type) {
      case 'type2':
        // draw knob
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(centerX, centerY, (imageWidth * 0.088785) / 2, 0, TWO_PI);
        ctx.closePath();
        ctx.fill();
        break

      case 'type1':
      /* falls through */
      default:
        // draw knob
        grad = ctx.createLinearGradient(
          centerX - (imageWidth * 0.027) / 2,
          centerY - (imageWidth * 0.027) / 2,
          centerX + (imageWidth * 0.027) / 2,
          centerY + (imageWidth * 0.027) / 2
        );
        grad.addColorStop(0, '#f3f4f7');
        grad.addColorStop(0.11, '#f3f5f7');
        grad.addColorStop(0.12, '#f1f3f5');
        grad.addColorStop(0.2, '#c0c5cb');
        grad.addColorStop(0.2, '#bec3c9');
        grad.addColorStop(1, '#bec3c9');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(centerX, centerY, imageWidth * 0.027, 0, TWO_PI);
        ctx.closePath();
        ctx.fill();
        break
    }

    ctx.restore();
  };

  const calculateAngles = function (hour, minute, second) {
    secondPointerAngle = second * ANGLE_STEP * RAD_FACTOR;
    minutePointerAngle = minute * ANGLE_STEP * RAD_FACTOR;
    hourPointerAngle = (hour + minute / 60) * ANGLE_STEP * 5 * RAD_FACTOR;
  };

  const tickTock = function () {
    objDate.setHours(hour);
    objDate.setMinutes(minute);
    objDate.setSeconds(second);
    // Seconds
    second =
      objDate.getSeconds() +
      (secondMovesContinuous ? objDate.getMilliseconds() / 1000 : 0);

    // Hours
    if (timeZoneOffsetHour !== 0) {
      hour = objDate.getUTCHours() + timeZoneOffsetHour;
    } else {
      hour = objDate.getHours();
    }
    hour = hour % 12;

    // Minutes
    if (timeZoneOffsetMinute !== 0) {
      minute = objDate.getUTCMinutes() + timeZoneOffsetMinute;
    } else {
      minute = objDate.getMinutes();
    }
    if (minute > 60) {
      minute -= 60;
      hour++;
    }
    if (minute < 0) {
      minute += 60;
      hour--;
    }
    hour = hour % 12;
    // Calculate angles from current hour and minute values
    calculateAngles(hour, minute, second);

    repaint();
  };

  // **************   Initialization  ********************
  // Draw all static painting code to background
  const init = function (parameters) {
    parameters = parameters || {};
    const drawFrame2 =
      undefined === parameters.frame ? false : parameters.frame;
    const drawBackground2 =
      undefined === parameters.background ? false : parameters.background;
    const drawPointers =
      undefined === parameters.pointers ? false : parameters.pointers;
    const drawForeground2 =
      undefined === parameters.foreground ? false : parameters.foreground;

    initialized = true;

    if (drawFrame2 && frameVisible) {
      drawFrame(
        frameContext,
        frameDesign,
        centerX,
        centerY,
        imageWidth,
        imageHeight
      );
    }

    if (drawBackground2 && backgroundVisible) {
      // Create background in background buffer (backgroundBuffer)
      drawBackground(
        backgroundContext,
        backgroundColor,
        centerX,
        centerY,
        imageWidth,
        imageHeight
      );

      // Create custom layer in background buffer (backgroundBuffer)
      drawRadialCustomImage(
        backgroundContext,
        customLayer,
        centerX,
        centerY,
        imageWidth,
        imageHeight
      );

      drawTickmarksImage(backgroundContext, pointerType);
    }

    if (drawPointers) {
      drawHourPointer(hourContext, pointerType);
      drawMinutePointer(minuteContext, pointerType);
      drawSecondPointer(secondContext, pointerType);
    }

    if (drawForeground2 && foregroundVisible) {
      drawTopKnob(foregroundContext, pointerType);
      drawForeground(
        foregroundContext,
        foregroundType,
        imageWidth,
        imageHeight,
        false
      );
    }
  };

  const repaint = function () {
    if (!initialized) {
      init({
        frame: true,
        background: true,
        pointers: true,
        foreground: true
      });
    }

    // mainCtx.save();
    mainCtx.clearRect(0, 0, mainCtx.canvas.width, mainCtx.canvas.height);

    // Draw frame
    if (frameVisible) {
      mainCtx.drawImage(frameBuffer, 0, 0);
    }

    // Draw buffered image to visible canvas
    if (backgroundVisible) {
      mainCtx.drawImage(backgroundBuffer, 0, 0);
    }

    // have to draw to a rotated temporary image area so we can translate in
    // absolute x, y values when drawing to main context
    const shadowOffset = imageWidth * 0.006;

    // draw hour pointer
    // Define rotation center
    mainCtx.save();
    mainCtx.translate(centerX, centerY);
    mainCtx.rotate(hourPointerAngle);
    mainCtx.translate(-centerX, -centerY);
    // Set the pointer shadow params
    mainCtx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    mainCtx.shadowOffsetX = mainCtx.shadowOffsetY = shadowOffset;
    mainCtx.shadowBlur = shadowOffset * 2;
    // Draw the pointer
    mainCtx.drawImage(hourBuffer, 0, 0);

    // draw minute pointer
    // Define rotation center
    mainCtx.translate(centerX, centerY);
    mainCtx.rotate(minutePointerAngle - hourPointerAngle);
    mainCtx.translate(-centerX, -centerY);
    mainCtx.drawImage(minuteBuffer, 0, 0);
    mainCtx.restore();

    if (pointerType.type === 'type1') {
      drawKnob(mainCtx);
    }

    if (secondPointerVisible) {
      // draw second pointer
      // Define rotation center
      mainCtx.save();
      mainCtx.translate(centerX, centerY);
      mainCtx.rotate(secondPointerAngle);
      mainCtx.translate(-centerX, -centerY);
      // Set the pointer shadow params
      mainCtx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      mainCtx.shadowOffsetX = mainCtx.shadowOffsetY = shadowOffset;
      mainCtx.shadowBlur = shadowOffset * 2;
      // Draw the pointer
      mainCtx.drawImage(secondBuffer, 0, 0);
      mainCtx.restore();
    }

    // Draw foreground
    if (foregroundVisible) {
      mainCtx.drawImage(foregroundBuffer, 0, 0);
    }
  };

  // Visualize the component
  tickTock();
}

class ClockElement extends BaseElement {
  static get drawFunction () { return drawClock }

  static get properties () {
    return {
      size: { type: Number, defaultValue: 200 },
      isCurrentTime: { type: Boolean, defaultValue: false },
      hour: { type: Number, defaultValue: 0 },
      minute: { type: Number, defaultValue: 0 },
      second: { type: Number, defaultValue: 0 },
      frameDesign: { type: String, objectEnum: FrameDesign, defaultValue: 'METAL' },
      noFrameVisible: { type: Boolean, defaultValue: false },
      pointerType: { type: String, objectEnum: PointerType, defaultValue: 'TYPE1' },
      pointerColor: { type: String, objectEnum: Color$1, defaultValue: 'GRAY' },
      backgroundColor: { type: String, objectEnum: BackgroundColor, defaultValue: 'ANTHRACITE' },
      noBackgroundVisible: { type: Boolean, defaultValue: false },
      foregroundType: { type: String, objectEnum: ForegroundType, defaultValue: 'TYPE1' },
      noForegroundVisible: { type: Boolean, defaultValue: false },
      timeZoneOffsetHour: { type: Number, defaultValue: 0 },
      timeZoneOffsetMinute: { type: Number, defaultValue: 0 },
      noSecondPointerVisible: { type: Boolean, defaultValue: false }
    }
  }

  constructor () {
    super();
    this._timer = timer(() => {});
    this._timer.stop();
  }

  disconnectedCallback () {
    super.disconnectedCallback();
    this._timer.stop();
  }

  render () {
    return $`
      <canvas width="${this.size}" height="${this.size}"></canvas>
    `
  }

  updated (changedProperties) {
    super.updated();
    if (this.isCurrentTime) {
      this._timer.restart(() => {
        const date = new Date();
        const hour = date.getHours();
        const minute = date.getMinutes();
        const second = date.getSeconds();
        if (this.hour !== hour ||
          this.minute !== minute ||
          this.second !== second) {
          this.setAttribute('hour', hour);
          this.setAttribute('minute', minute);
          this.setAttribute('second', second);
        }
      });
    } else {
      this._timer.stop();
    }
  }
}

window.customElements.define('steelseries-clock', ClockElement);

function drawBattery (canvas, parameters) {
  parameters = parameters || {};
  let size = undefined === parameters.size ? 0 : parameters.size;
  const value = undefined === parameters.value ? 50 : parameters.value;

  // Get the canvas context and clear it
  const mainCtx = getCanvasContext(canvas);

  // Has a size been specified?
  if (size === 0) {
    size = mainCtx.canvas.width;
  }

  const imageWidth = size;
  const imageHeight = Math.ceil(size * 0.45);

  // Set the size - also clears the canvas
  mainCtx.canvas.width = imageWidth;
  mainCtx.canvas.height = imageHeight;

  const createBatteryImage = function (ctx, imageWidth, imageHeight, value) {
    let grad;

    // Background
    ctx.beginPath();
    ctx.moveTo(imageWidth * 0.025, imageHeight * 0.055555);
    ctx.lineTo(imageWidth * 0.9, imageHeight * 0.055555);
    ctx.lineTo(imageWidth * 0.9, imageHeight * 0.944444);
    ctx.lineTo(imageWidth * 0.025, imageHeight * 0.944444);
    ctx.lineTo(imageWidth * 0.025, imageHeight * 0.055555);
    ctx.closePath();
    //
    ctx.beginPath();
    ctx.moveTo(imageWidth * 0.925, 0);
    ctx.lineTo(0, 0);
    ctx.lineTo(0, imageHeight);
    ctx.lineTo(imageWidth * 0.925, imageHeight);
    ctx.lineTo(imageWidth * 0.925, imageHeight * 0.722222);
    ctx.bezierCurveTo(
      imageWidth * 0.925,
      imageHeight * 0.722222,
      imageWidth * 0.975,
      imageHeight * 0.722222,
      imageWidth * 0.975,
      imageHeight * 0.722222
    );
    ctx.bezierCurveTo(
      imageWidth,
      imageHeight * 0.722222,
      imageWidth,
      imageHeight * 0.666666,
      imageWidth,
      imageHeight * 0.666666
    );
    ctx.bezierCurveTo(
      imageWidth,
      imageHeight * 0.666666,
      imageWidth,
      imageHeight * 0.333333,
      imageWidth,
      imageHeight * 0.333333
    );
    ctx.bezierCurveTo(
      imageWidth,
      imageHeight * 0.333333,
      imageWidth,
      imageHeight * 0.277777,
      imageWidth * 0.975,
      imageHeight * 0.277777
    );
    ctx.bezierCurveTo(
      imageWidth * 0.975,
      imageHeight * 0.277777,
      imageWidth * 0.925,
      imageHeight * 0.277777,
      imageWidth * 0.925,
      imageHeight * 0.277777
    );
    ctx.lineTo(imageWidth * 0.925, 0);
    ctx.closePath();
    //
    grad = ctx.createLinearGradient(0, 0, 0, imageHeight);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#7e7e7e');
    ctx.fillStyle = grad;
    ctx.fill();

    // Main
    ctx.beginPath();
    let end = Math.max(
      imageWidth * 0.875 * (value / 100),
      Math.ceil(imageWidth * 0.01)
    );
    ctx.rect(
      imageWidth * 0.025,
      imageWidth * 0.025,
      end,
      imageHeight * 0.888888
    );
    ctx.closePath();
    const BORDER_FRACTIONS = [0, 0.4, 1];
    const BORDER_COLORS = [
      new rgbaColor(177, 25, 2, 1), // 0xB11902
      new rgbaColor(219, 167, 21, 1), // 0xDBA715
      new rgbaColor(121, 162, 75, 1) // 0x79A24B
    ];
    const border = new gradientWrapper(0, 100, BORDER_FRACTIONS, BORDER_COLORS);
    ctx.fillStyle = border.getColorAt(value / 100).getRgbColor();
    ctx.fill();
    ctx.beginPath();
    end = Math.max(end - imageWidth * 0.05, 0);
    ctx.rect(imageWidth * 0.05, imageWidth * 0.05, end, imageHeight * 0.777777);
    ctx.closePath();
    const LIQUID_COLORS_DARK = [
      new rgbaColor(198, 39, 5, 1), // 0xC62705
      new rgbaColor(228, 189, 32, 1), // 0xE4BD20
      new rgbaColor(163, 216, 102, 1) // 0xA3D866
    ];

    const LIQUID_COLORS_LIGHT = [
      new rgbaColor(246, 121, 48, 1), // 0xF67930
      new rgbaColor(246, 244, 157, 1), // 0xF6F49D
      new rgbaColor(223, 233, 86, 1) // 0xDFE956
    ];
    const LIQUID_GRADIENT_FRACTIONS = [0, 0.4, 1];
    const liquidDark = new gradientWrapper(
      0,
      100,
      LIQUID_GRADIENT_FRACTIONS,
      LIQUID_COLORS_DARK
    );
    const liquidLight = new gradientWrapper(
      0,
      100,
      LIQUID_GRADIENT_FRACTIONS,
      LIQUID_COLORS_LIGHT
    );
    grad = ctx.createLinearGradient(
      imageWidth * 0.05,
      0,
      imageWidth * 0.875,
      0
    );
    grad.addColorStop(0, liquidDark.getColorAt(value / 100).getRgbColor());
    grad.addColorStop(0.5, liquidLight.getColorAt(value / 100).getRgbColor());
    grad.addColorStop(1, liquidDark.getColorAt(value / 100).getRgbColor());
    ctx.fillStyle = grad;
    ctx.fill();

    // Foreground
    ctx.beginPath();
    ctx.rect(
      imageWidth * 0.025,
      imageWidth * 0.025,
      imageWidth * 0.875,
      imageHeight * 0.444444
    );
    ctx.closePath();
    grad = ctx.createLinearGradient(
      imageWidth * 0.025,
      imageWidth * 0.025,
      imageWidth * 0.875,
      imageHeight * 0.444444
    );
    grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0.8)');
    ctx.fillStyle = grad;
    ctx.fill();
  };

  const repaint = function () {
    mainCtx.clearRect(0, 0, mainCtx.canvas.width, mainCtx.canvas.height);
    createBatteryImage(mainCtx, imageWidth, imageHeight, value);
  };

  // Visualize the component
  repaint();
}

class BatteryElement extends BaseElement {
  static get drawFunction () { return drawBattery }

  static get properties () {
    return {
      size: { type: Number, defaultValue: 80 },
      value: { type: Number, defaultValue: 0 },
      real_value: { state: true },
      transitionTime: { type: Number, defaultValue: 500 }
    }
  }

  constructor () {
    super();
    this._timer = timer(() => {});
    this._timer.stop();
  }

  connectedCallback () {
    super.connectedCallback();
    this.real_value = this.real_value ?? 0;
  }

  render () {
    return $`
      <canvas width="${this.size}" height="${Math.ceil(this.size * 0.45)}"></canvas>
    `
  }

  updated (changedProperties) {
    super.updated();
    if (changedProperties.has('value') || changedProperties.has('transitionTime')) {
      const transitionTime = this.transitionTime;
      const originTime = now();
      const originValue = this.real_value;
      const targetValue = this.value;
      const timeScale = transitionTime <= 0 ? () => 1 : linear().domain([0, transitionTime]).clamp(true);
      const valueScale = linear().range([originValue, targetValue]).clamp(true);
      this._timer.restart((elapsedTime) => {
        const scaled = timeScale(elapsedTime);
        const eased = cubicInOut(scaled);
        const newValue = valueScale(eased);
        this.real_value = newValue;
        if (now() >= originTime + transitionTime) {
          this._timer.stop();
        }
      });
    }
  }
}

window.customElements.define('steelseries-battery', BatteryElement);

function drawStopwatch (canvas, parameters) {
  parameters = parameters || {};
  let size = undefined === parameters.size ? 0 : parameters.size;
  const frameDesign =
    undefined === parameters.frameDesign
      ? FrameDesign.METAL
      : parameters.frameDesign;
  const frameVisible =
    undefined === parameters.frameVisible ? true : parameters.frameVisible;
  const pointerColor =
    undefined === parameters.pointerColor
      ? Color$1.BLACK
      : parameters.pointerColor;
  const backgroundColor =
    undefined === parameters.backgroundColor
      ? BackgroundColor.LIGHT_GRAY
      : parameters.backgroundColor;
  const backgroundVisible =
    undefined === parameters.backgroundVisible
      ? true
      : parameters.backgroundVisible;
  const foregroundType =
    undefined === parameters.foregroundType
      ? ForegroundType.TYPE1
      : parameters.foregroundType;
  const foregroundVisible =
    undefined === parameters.foregroundVisible
      ? true
      : parameters.foregroundVisible;
  const customLayer =
    undefined === parameters.customLayer ? null : parameters.customLayer;

  const seconds = parameters.seconds ?? 0;

  const ANGLE_STEP = 6;

  // Get the canvas context
  const mainCtx = getCanvasContext(canvas);

  let initialized = false;

  let minutePointerAngle;
  let secondPointerAngle;

  const drawTickmarksImage = function (
    ctx,
    width,
    range,
    text_scale,
    text_dist_factor,
    x_offset,
    y_offset
  ) {
    const STD_FONT_SIZE = text_scale * width;
    const STD_FONT = STD_FONT_SIZE + 'px ' + stdFontName;
    const TEXT_WIDTH = width * 0.15;
    const THIN_STROKE = 0.5;
    const MEDIUM_STROKE = 1;
    const THICK_STROKE = 1.5;
    const TEXT_DISTANCE = text_dist_factor * width;
    const MIN_LENGTH = Math.round(0.025 * width);
    const MED_LENGTH = Math.round(0.035 * width);
    const MAX_LENGTH = Math.round(0.045 * width);
    const TEXT_COLOR = backgroundColor.labelColor.getRgbaColor();
    const TICK_COLOR = backgroundColor.labelColor.getRgbaColor();
    const CENTER = width / 2;
    // Create the ticks itself
    const RADIUS = width * 0.4;
    let innerPoint;
    let outerPoint;
    let textPoint;
    let counter = 0;
    let numberCounter = 0;
    let valueCounter; // value for the tickmarks
    let sinValue = 0;
    let cosValue = 0;
    let alpha; // angle for the tickmarks
    const ALPHA_START = -PI;
    const ANGLE_STEPSIZE = TWO_PI / range;

    ctx.width = ctx.height = width;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = STD_FONT;

    for (
      alpha = ALPHA_START, valueCounter = 0;
      valueCounter <= range + 1;
      alpha -= ANGLE_STEPSIZE * 0.1, valueCounter += 0.1
    ) {
      ctx.lineWidth = THIN_STROKE;
      sinValue = Math.sin(alpha);
      cosValue = Math.cos(alpha);

      // tickmark every 2 units
      if (counter % 2 === 0) {
        // ctx.lineWidth = THIN_STROKE;
        innerPoint = [
          CENTER + (RADIUS - MIN_LENGTH) * sinValue + x_offset,
          CENTER + (RADIUS - MIN_LENGTH) * cosValue + y_offset
        ];
        outerPoint = [
          CENTER + RADIUS * sinValue + x_offset,
          CENTER + RADIUS * cosValue + y_offset
        ];
        // Draw ticks
        ctx.strokeStyle = TICK_COLOR;
        ctx.beginPath();
        ctx.moveTo(innerPoint[0], innerPoint[1]);
        ctx.lineTo(outerPoint[0], outerPoint[1]);
        ctx.closePath();
        ctx.stroke();
      }

      // Different tickmark every 10 units
      if (counter === 10 || counter === 0) {
        ctx.fillStyle = TEXT_COLOR;
        ctx.lineWidth = MEDIUM_STROKE;
        outerPoint = [
          CENTER + RADIUS * sinValue + x_offset,
          CENTER + RADIUS * cosValue + y_offset
        ];
        textPoint = [
          CENTER + (RADIUS - TEXT_DISTANCE) * sinValue + x_offset,
          CENTER + (RADIUS - TEXT_DISTANCE) * cosValue + y_offset
        ];

        // Draw text
        if (numberCounter === 5) {
          if (valueCounter !== range) {
            if (Math.round(valueCounter) !== 60) {
              ctx.fillText(
                Math.round(valueCounter),
                textPoint[0],
                textPoint[1],
                TEXT_WIDTH
              );
            }
          }
          ctx.lineWidth = THICK_STROKE;
          innerPoint = [
            CENTER + (RADIUS - MAX_LENGTH) * sinValue + x_offset,
            CENTER + (RADIUS - MAX_LENGTH) * cosValue + y_offset
          ];
          numberCounter = 0;
        } else {
          ctx.lineWidth = MEDIUM_STROKE;
          innerPoint = [
            CENTER + (RADIUS - MED_LENGTH) * sinValue + x_offset,
            CENTER + (RADIUS - MED_LENGTH) * cosValue + y_offset
          ];
        }

        // Draw ticks
        ctx.strokeStyle = TICK_COLOR;
        ctx.beginPath();
        ctx.moveTo(innerPoint[0], innerPoint[1]);
        ctx.lineTo(outerPoint[0], outerPoint[1]);
        ctx.closePath();
        ctx.stroke();

        counter = 0;
        numberCounter++;
      }
      counter++;
    }
    ctx.restore();
  };

  const drawLargePointer = function (ctx) {
    let grad;
    let radius;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(imageWidth * 0.509345, imageWidth * 0.457943);
    ctx.lineTo(imageWidth * 0.5, imageWidth * 0.102803);
    ctx.lineTo(imageWidth * 0.490654, imageWidth * 0.457943);
    ctx.bezierCurveTo(
      imageWidth * 0.490654,
      imageWidth * 0.457943,
      imageWidth * 0.490654,
      imageWidth * 0.457943,
      imageWidth * 0.490654,
      imageWidth * 0.457943
    );
    ctx.bezierCurveTo(
      imageWidth * 0.471962,
      imageWidth * 0.462616,
      imageWidth * 0.457943,
      imageWidth * 0.481308,
      imageWidth * 0.457943,
      imageWidth * 0.5
    );
    ctx.bezierCurveTo(
      imageWidth * 0.457943,
      imageWidth * 0.518691,
      imageWidth * 0.471962,
      imageWidth * 0.537383,
      imageWidth * 0.490654,
      imageWidth * 0.542056
    );
    ctx.bezierCurveTo(
      imageWidth * 0.490654,
      imageWidth * 0.542056,
      imageWidth * 0.490654,
      imageWidth * 0.542056,
      imageWidth * 0.490654,
      imageWidth * 0.542056
    );
    ctx.lineTo(imageWidth * 0.490654, imageWidth * 0.621495);
    ctx.lineTo(imageWidth * 0.509345, imageWidth * 0.621495);
    ctx.lineTo(imageWidth * 0.509345, imageWidth * 0.542056);
    ctx.bezierCurveTo(
      imageWidth * 0.509345,
      imageWidth * 0.542056,
      imageWidth * 0.509345,
      imageWidth * 0.542056,
      imageWidth * 0.509345,
      imageWidth * 0.542056
    );
    ctx.bezierCurveTo(
      imageWidth * 0.528037,
      imageWidth * 0.537383,
      imageWidth * 0.542056,
      imageWidth * 0.518691,
      imageWidth * 0.542056,
      imageWidth * 0.5
    );
    ctx.bezierCurveTo(
      imageWidth * 0.542056,
      imageWidth * 0.481308,
      imageWidth * 0.528037,
      imageWidth * 0.462616,
      imageWidth * 0.509345,
      imageWidth * 0.457943
    );
    ctx.bezierCurveTo(
      imageWidth * 0.509345,
      imageWidth * 0.457943,
      imageWidth * 0.509345,
      imageWidth * 0.457943,
      imageWidth * 0.509345,
      imageWidth * 0.457943
    );
    ctx.closePath();
    grad = ctx.createLinearGradient(0, 0, 0, imageWidth * 0.621495);
    grad.addColorStop(0, pointerColor.medium.getRgbaColor());
    grad.addColorStop(0.388888, pointerColor.medium.getRgbaColor());
    grad.addColorStop(0.5, pointerColor.light.getRgbaColor());
    grad.addColorStop(0.611111, pointerColor.medium.getRgbaColor());
    grad.addColorStop(1, pointerColor.medium.getRgbaColor());
    ctx.fillStyle = grad;
    ctx.strokeStyle = pointerColor.dark.getRgbaColor();
    ctx.fill();
    ctx.stroke();
    // Draw the rings
    ctx.beginPath();
    radius = (imageWidth * 0.06542) / 2;
    ctx.arc(centerX, centerY, radius, 0, TWO_PI);
    grad = ctx.createLinearGradient(
      centerX - radius,
      centerX + radius,
      0,
      centerX + radius
    );
    grad.addColorStop(0, '#e6b35c');
    grad.addColorStop(0.01, '#e6b35c');
    grad.addColorStop(0.99, '#c48200');
    grad.addColorStop(1, '#c48200');
    ctx.fillStyle = grad;
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    radius = (imageWidth * 0.046728) / 2;
    ctx.arc(centerX, centerY, radius, 0, TWO_PI);
    grad = ctx.createRadialGradient(
      centerX,
      centerX,
      0,
      centerX,
      centerX,
      radius
    );
    grad.addColorStop(0, '#c5c5c5');
    grad.addColorStop(0.19, '#c5c5c5');
    grad.addColorStop(0.22, '#000000');
    grad.addColorStop(0.8, '#000000');
    grad.addColorStop(0.99, '#707070');
    grad.addColorStop(1, '#707070');
    ctx.fillStyle = grad;
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  const drawSmallPointer = function (ctx) {
    let radius;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(imageWidth * 0.476635, imageWidth * 0.313084);
    ctx.bezierCurveTo(
      imageWidth * 0.476635,
      imageWidth * 0.322429,
      imageWidth * 0.485981,
      imageWidth * 0.331775,
      imageWidth * 0.495327,
      imageWidth * 0.336448
    );
    ctx.bezierCurveTo(
      imageWidth * 0.495327,
      imageWidth * 0.336448,
      imageWidth * 0.495327,
      imageWidth * 0.350467,
      imageWidth * 0.495327,
      imageWidth * 0.350467
    );
    ctx.lineTo(imageWidth * 0.504672, imageWidth * 0.350467);
    ctx.bezierCurveTo(
      imageWidth * 0.504672,
      imageWidth * 0.350467,
      imageWidth * 0.504672,
      imageWidth * 0.336448,
      imageWidth * 0.504672,
      imageWidth * 0.336448
    );
    ctx.bezierCurveTo(
      imageWidth * 0.514018,
      imageWidth * 0.331775,
      imageWidth * 0.523364,
      imageWidth * 0.322429,
      imageWidth * 0.523364,
      imageWidth * 0.313084
    );
    ctx.bezierCurveTo(
      imageWidth * 0.523364,
      imageWidth * 0.303738,
      imageWidth * 0.514018,
      imageWidth * 0.294392,
      imageWidth * 0.504672,
      imageWidth * 0.289719
    );
    ctx.bezierCurveTo(
      imageWidth * 0.504672,
      imageWidth * 0.289719,
      imageWidth * 0.5,
      imageWidth * 0.200934,
      imageWidth * 0.5,
      imageWidth * 0.200934
    );
    ctx.bezierCurveTo(
      imageWidth * 0.5,
      imageWidth * 0.200934,
      imageWidth * 0.495327,
      imageWidth * 0.289719,
      imageWidth * 0.495327,
      imageWidth * 0.289719
    );
    ctx.bezierCurveTo(
      imageWidth * 0.485981,
      imageWidth * 0.294392,
      imageWidth * 0.476635,
      imageWidth * 0.303738,
      imageWidth * 0.476635,
      imageWidth * 0.313084
    );
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, imageWidth, 0);
    grad.addColorStop(0, pointerColor.medium.getRgbaColor());
    grad.addColorStop(0.388888, pointerColor.medium.getRgbaColor());
    grad.addColorStop(0.5, pointerColor.light.getRgbaColor());
    grad.addColorStop(0.611111, pointerColor.medium.getRgbaColor());
    grad.addColorStop(1, pointerColor.medium.getRgbaColor());
    ctx.fillStyle = grad;
    ctx.strokeStyle = pointerColor.dark.getRgbaColor();
    ctx.fill();
    ctx.stroke();
    // Draw the rings
    ctx.beginPath();
    radius = (imageWidth * 0.037383) / 2;
    ctx.arc(
      centerX,
      smallPointerY_Offset + smallPointerSize / 2,
      radius,
      0,
      TWO_PI
    );
    ctx.fillStyle = '#C48200';
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    radius = (imageWidth * 0.028037) / 2;
    ctx.arc(
      centerX,
      smallPointerY_Offset + smallPointerSize / 2,
      radius,
      0,
      TWO_PI
    );
    ctx.fillStyle = '#999999';
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    radius = (imageWidth * 0.018691) / 2;
    ctx.arc(
      centerX,
      smallPointerY_Offset + smallPointerSize / 2,
      radius,
      0,
      TWO_PI
    );
    ctx.fillStyle = '#000000';
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  const calculateAngles = function () {
    secondPointerAngle = seconds * ANGLE_STEP;
    minutePointerAngle = (seconds / 60) * ANGLE_STEP * 2;
  };

  const init = function (parameters) {
    parameters = parameters || {};
    const drawFrame2 =
      undefined === parameters.frame ? false : parameters.frame;
    const drawBackground2 =
      undefined === parameters.background ? false : parameters.background;
    const drawPointers =
      undefined === parameters.pointers ? false : parameters.pointers;
    const drawForeground2 =
      undefined === parameters.foreground ? false : parameters.foreground;

    initialized = true;

    if (drawFrame2 && frameVisible) {
      drawFrame(
        frameContext,
        frameDesign,
        centerX,
        centerY,
        imageWidth,
        imageHeight
      );
    }

    if (drawBackground2 && backgroundVisible) {
      // Create background in background buffer (backgroundBuffer)
      drawBackground(
        backgroundContext,
        backgroundColor,
        centerX,
        centerY,
        imageWidth,
        imageHeight
      );

      // Create custom layer in background buffer (backgroundBuffer)
      drawRadialCustomImage(
        backgroundContext,
        customLayer,
        centerX,
        centerY,
        imageWidth,
        imageHeight
      );

      drawTickmarksImage(backgroundContext, imageWidth, 60, 0.075, 0.1, 0, 0);
      drawTickmarksImage(
        backgroundContext,
        smallPointerSize,
        30,
        0.095,
        0.13,
        smallPointerX_Offset,
        smallPointerY_Offset
      );
    }
    if (drawPointers) {
      drawLargePointer(largePointerContext);
      drawSmallPointer(smallPointerContext);
    }

    if (drawForeground2 && foregroundVisible) {
      drawForeground(
        foregroundContext,
        foregroundType,
        imageWidth,
        imageHeight,
        false
      );
    }
  };

  const repaint = function () {
    if (!initialized) {
      init({
        frame: true,
        background: true,
        pointers: true,
        foreground: true
      });
    }

    mainCtx.clearRect(0, 0, imageWidth, imageHeight);

    // Draw frame
    if (frameVisible) {
      mainCtx.drawImage(frameBuffer, 0, 0);
    }

    // Draw buffered image to visible canvas
    if (backgroundVisible) {
      mainCtx.drawImage(backgroundBuffer, 0, 0);
    }

    // have to draw to a rotated temporary image area so we can translate in
    // absolute x, y values when drawing to main context
    const shadowOffset = imageWidth * 0.006;

    const rotationAngle =
      (minutePointerAngle + 2 * Math.sin(minutePointerAngle * RAD_FACTOR)) *
      RAD_FACTOR;
    const secRotationAngle =
      (secondPointerAngle + 2 * Math.sin(secondPointerAngle * RAD_FACTOR)) *
      RAD_FACTOR;

    // Draw the minute pointer
    // Define rotation center
    mainCtx.save();
    mainCtx.translate(centerX, smallPointerY_Offset + smallPointerSize / 2);
    mainCtx.rotate(rotationAngle);
    mainCtx.translate(-centerX, -(smallPointerY_Offset + smallPointerSize / 2));
    // Set the pointer shadow params
    mainCtx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    mainCtx.shadowOffsetX = mainCtx.shadowOffsetY = shadowOffset / 2;
    mainCtx.shadowBlur = shadowOffset;
    // Draw the pointer
    mainCtx.drawImage(smallPointerBuffer, 0, 0);
    mainCtx.restore();

    // Draw the second pointer
    // Define rotation center
    mainCtx.save();
    mainCtx.translate(centerX, centerY);
    mainCtx.rotate(secRotationAngle);
    mainCtx.translate(-centerX, -centerY);
    // Set the pointer shadow params
    mainCtx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    mainCtx.shadowOffsetX = mainCtx.shadowOffsetY = shadowOffset / 2;
    mainCtx.shadowBlur = shadowOffset;
    // Draw the pointer
    mainCtx.drawImage(largePointerBuffer, 0, 0);
    // Undo the translations & shadow settings
    mainCtx.restore();

    // Draw the foreground
    if (foregroundVisible) {
      mainCtx.drawImage(foregroundBuffer, 0, 0);
    }
  };

  // Has a size been specified?
  size =
    size === 0 ? Math.min(mainCtx.canvas.width, mainCtx.canvas.height) : size;

  // Set the size - also clears it
  mainCtx.canvas.width = size;
  mainCtx.canvas.height = size;

  const imageWidth = size;
  const imageHeight = size;

  const centerX = imageWidth / 2;
  const centerY = imageHeight / 2;

  const smallPointerSize = 0.285 * imageWidth;
  const smallPointerX_Offset = centerX - smallPointerSize / 2;
  const smallPointerY_Offset = 0.17 * imageWidth;

  // Buffer for the frame
  const frameBuffer = createBuffer(size, size);
  const frameContext = frameBuffer.getContext('2d');

  // Buffer for static background painting code
  const backgroundBuffer = createBuffer(size, size);
  const backgroundContext = backgroundBuffer.getContext('2d');

  // Buffer for small pointer image painting code
  const smallPointerBuffer = createBuffer(size, size);
  const smallPointerContext = smallPointerBuffer.getContext('2d');

  // Buffer for large pointer image painting code
  const largePointerBuffer = createBuffer(size, size);
  const largePointerContext = largePointerBuffer.getContext('2d');

  // Buffer for static foreground painting code
  const foregroundBuffer = createBuffer(size, size);
  const foregroundContext = foregroundBuffer.getContext('2d');

  // Visualize the component
  calculateAngles();
  repaint();
}

class StopwatchElement extends BaseElement {
  static get drawFunction () { return drawStopwatch }

  static get properties () {
    return {
      size: { type: Number, defaultValue: 200 },
      seconds: { type: Number, defaultValue: 0 },
      running: { type: Boolean, defaultValue: false },
      frameDesign: { type: String, objectEnum: FrameDesign, defaultValue: 'METAL' },
      noFrameVisible: { type: Boolean, defaultValue: false },
      pointerColor: { type: String, objectEnum: Color$1, defaultValue: 'BLACK' },
      backgroundColor: { type: String, objectEnum: BackgroundColor, defaultValue: 'DARK_GRAY' },
      noBackgroundVisible: { type: Boolean, defaultValue: false },
      foregroundType: { type: String, objectEnum: ForegroundType, defaultValue: 'TYPE1' },
      noForegroundVisible: { type: Boolean, defaultValue: false }
    }
  }

  constructor () {
    super();
    this._timer = timer(() => {});
    this._timer.stop();
    this._timerRunning = false;
  }

  disconnectedCallback () {
    super.disconnectedCallback();
    this._timer.stop();
    this._timerRunning = false;
  }

  render () {
    return $`
      <canvas width="${this.size}" height="${this.size}"></canvas>
    `
  }

  updated (changedProperties) {
    super.updated();
    if (this.running !== this._timerRunning) {
      if (this.running) {
        let lastEllapsedTime = 0;
        let seconds = this.seconds;
        this._timer.restart((ellapsedTime) => {
          seconds += (ellapsedTime - lastEllapsedTime) / 1000;
          if (Math.floor(seconds) !== this.seconds) {
            this.setAttribute('seconds', Math.floor(seconds));
          }
          lastEllapsedTime = ellapsedTime;
        });
      } else {
        this._timer.stop();
      }
      this._timerRunning = this.running;
    }
  }
}

window.customElements.define('steelseries-stopwatch', StopwatchElement);

function drawAltimeter (canvas, parameters) {
  parameters = parameters || {};
  // parameters
  let size = undefined === parameters.size ? 0 : parameters.size;
  const frameDesign =
    undefined === parameters.frameDesign
      ? FrameDesign.METAL
      : parameters.frameDesign;
  const frameVisible =
    undefined === parameters.frameVisible ? true : parameters.frameVisible;
  const backgroundColor =
    undefined === parameters.backgroundColor
      ? BackgroundColor.DARK_GRAY
      : parameters.backgroundColor;
  const backgroundVisible =
    undefined === parameters.backgroundVisible
      ? true
      : parameters.backgroundVisible;
  const titleString =
    undefined === parameters.titleString ? '' : parameters.titleString;
  const unitString =
    undefined === parameters.unitString ? '' : parameters.unitString;
  const unitAltPos = parameters.unitAltPos ?? false;
  const knobType =
    undefined === parameters.knobType
      ? KnobType.METAL_KNOB
      : parameters.knobType;
  const knobStyle =
    undefined === parameters.knobStyle ? KnobStyle.BLACK : parameters.knobStyle;
  const lcdColor =
    undefined === parameters.lcdColor ? LcdColor.BLACK : parameters.lcdColor;
  const lcdVisible =
    undefined === parameters.lcdVisible ? true : parameters.lcdVisible;
  const digitalFont =
    undefined === parameters.digitalFont ? false : parameters.digitalFont;
  const foregroundType =
    undefined === parameters.foregroundType
      ? ForegroundType.TYPE1
      : parameters.foregroundType;
  const foregroundVisible =
    undefined === parameters.foregroundVisible
      ? true
      : parameters.foregroundVisible;
  const customLayer =
    undefined === parameters.customLayer ? null : parameters.customLayer;
  //
  const minValue = 0;
  const maxValue = 10;
  const value = parameters.value ?? minValue;
  let value100 = 0;
  let value1000 = 0;
  let value10000 = 0;
  let angleStep100ft;
  let angleStep1000ft;
  let angleStep10000ft;
  const mainCtx = getCanvasContext(canvas); // Get the canvas context
  // Constants
  const TICKMARK_OFFSET = PI;
  //
  let initialized = false;
  // **************   Buffer creation  ********************
  // Buffer for the frame
  const frameBuffer = createBuffer(size, size);
  const frameContext = frameBuffer.getContext('2d');
  // Buffer for the background
  const backgroundBuffer = createBuffer(size, size);
  const backgroundContext = backgroundBuffer.getContext('2d');

  let lcdBuffer;

  // Buffer for 10000ft pointer image painting code
  const pointer10000Buffer = createBuffer(size, size);
  const pointer10000Context = pointer10000Buffer.getContext('2d');

  // Buffer for 1000ft pointer image painting code
  const pointer1000Buffer = createBuffer(size, size);
  const pointer1000Context = pointer1000Buffer.getContext('2d');

  // Buffer for 100ft pointer image painting code
  const pointer100Buffer = createBuffer(size, size);
  const pointer100Context = pointer100Buffer.getContext('2d');

  // Buffer for static foreground painting code
  const foregroundBuffer = createBuffer(size, size);
  const foregroundContext = foregroundBuffer.getContext('2d');
  // End of variables

  // Get the canvas context and clear it
  mainCtx.save();
  // Has a size been specified?
  size =
    size === 0 ? Math.min(mainCtx.canvas.width, mainCtx.canvas.height) : size;

  // Set the size
  mainCtx.canvas.width = size;
  mainCtx.canvas.height = size;

  const imageWidth = size;
  const imageHeight = size;

  const centerX = imageWidth / 2;
  const centerY = imageHeight / 2;

  const unitStringPosY = unitAltPos ? imageHeight * 0.68 : false;

  const stdFont = Math.floor(imageWidth * 0.09) + 'px ' + stdFontName;

  // **************   Image creation  ********************
  const drawLcdText = function (value) {
    mainCtx.save();
    mainCtx.textAlign = 'right';
    mainCtx.textBaseline = 'middle';
    mainCtx.strokeStyle = lcdColor.textColor;
    mainCtx.fillStyle = lcdColor.textColor;

    if (
      lcdColor === LcdColor.STANDARD ||
      lcdColor === LcdColor.STANDARD_GREEN
    ) {
      mainCtx.shadowColor = 'gray';
      mainCtx.shadowOffsetX = imageWidth * 0.007;
      mainCtx.shadowOffsetY = imageWidth * 0.007;
      mainCtx.shadowBlur = imageWidth * 0.009;
    }
    if (digitalFont) {
      mainCtx.font = Math.floor(imageWidth * 0.075) + 'px ' + lcdFontName;
    } else {
      mainCtx.font = Math.floor(imageWidth * 0.075) + 'px bold ' + stdFontName;
    }
    mainCtx.fillText(
      Math.round(value),
      (imageWidth + imageWidth * 0.4) / 2 - 4,
      imageWidth * 0.607,
      imageWidth * 0.4
    );
    mainCtx.restore();
  };

  const drawTickmarksImage = function (
    ctx,
    freeAreaAngle,
    offset,
    minVal,
    maxVal,
    angleStep
  ) {
    const MEDIUM_STROKE = Math.max(imageWidth * 0.012, 2);
    const THIN_STROKE = Math.max(imageWidth * 0.007, 1.5);
    const TEXT_DISTANCE = imageWidth * 0.13;
    const MED_LENGTH = imageWidth * 0.05;
    const MAX_LENGTH = imageWidth * 0.07;
    const RADIUS = imageWidth * 0.4;
    let counter = 0;
    let sinValue = 0;
    let cosValue = 0;
    let alpha; // angle for tickmarks
    let valueCounter; // value for tickmarks
    const ALPHA_START = -offset - freeAreaAngle / 2;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = stdFont;
    ctx.strokeStyle = backgroundColor.labelColor.getRgbaColor();
    ctx.fillStyle = backgroundColor.labelColor.getRgbaColor();

    for (
      alpha = ALPHA_START, valueCounter = 0;
      valueCounter <= 10;
      alpha -= angleStep * 0.1, valueCounter += 0.1
    ) {
      sinValue = Math.sin(alpha);
      cosValue = Math.cos(alpha);

      // tickmark every 2 units
      if (counter % 2 === 0) {
        ctx.lineWidth = THIN_STROKE;
        // Draw ticks
        ctx.beginPath();
        ctx.moveTo(
          centerX + (RADIUS - MED_LENGTH) * sinValue,
          centerY + (RADIUS - MED_LENGTH) * cosValue
        );
        ctx.lineTo(centerX + RADIUS * sinValue, centerY + RADIUS * cosValue);
        ctx.closePath();
        ctx.stroke();
      }

      // Different tickmark every 10 units
      if (counter === 10 || counter === 0) {
        ctx.lineWidth = MEDIUM_STROKE;

        // if gauge is full circle, avoid painting maxValue over minValue
        if (freeAreaAngle === 0) {
          if (Math.round(valueCounter) !== maxValue) {
            ctx.fillText(
              Math.round(valueCounter).toString(),
              centerX + (RADIUS - TEXT_DISTANCE) * sinValue,
              centerY + (RADIUS - TEXT_DISTANCE) * cosValue
            );
          }
        }
        counter = 0;

        // Draw ticks
        ctx.beginPath();
        ctx.moveTo(
          centerX + (RADIUS - MAX_LENGTH) * sinValue,
          centerY + (RADIUS - MAX_LENGTH) * cosValue
        );
        ctx.lineTo(centerX + RADIUS * sinValue, centerY + RADIUS * cosValue);
        ctx.closePath();
        ctx.stroke();
      }
      counter++;
    }
    ctx.restore();
  };

  const draw100ftPointer = function (ctx, shadow) {
    let grad;

    if (shadow) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    } else {
      grad = ctx.createLinearGradient(
        0,
        imageHeight * 0.168224,
        0,
        imageHeight * 0.626168
      );
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.31, '#ffffff');
      grad.addColorStop(0.3101, '#ffffff');
      grad.addColorStop(0.32, '#202020');
      grad.addColorStop(1, '#202020');
      ctx.fillStyle = grad;
    }

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(imageWidth * 0.518691, imageHeight * 0.471962);
    ctx.bezierCurveTo(
      imageWidth * 0.514018,
      imageHeight * 0.471962,
      imageWidth * 0.509345,
      imageHeight * 0.467289,
      imageWidth * 0.509345,
      imageHeight * 0.467289
    );
    ctx.lineTo(imageWidth * 0.509345, imageHeight * 0.200934);
    ctx.lineTo(imageWidth * 0.5, imageHeight * 0.168224);
    ctx.lineTo(imageWidth * 0.490654, imageHeight * 0.200934);
    ctx.lineTo(imageWidth * 0.490654, imageHeight * 0.467289);
    ctx.bezierCurveTo(
      imageWidth * 0.490654,
      imageHeight * 0.467289,
      imageWidth * 0.481308,
      imageHeight * 0.471962,
      imageWidth * 0.481308,
      imageHeight * 0.471962
    );
    ctx.bezierCurveTo(
      imageWidth * 0.471962,
      imageHeight * 0.481308,
      imageWidth * 0.467289,
      imageHeight * 0.490654,
      imageWidth * 0.467289,
      imageHeight * 0.5
    );
    ctx.bezierCurveTo(
      imageWidth * 0.467289,
      imageHeight * 0.514018,
      imageWidth * 0.476635,
      imageHeight * 0.528037,
      imageWidth * 0.490654,
      imageHeight * 0.53271
    );
    ctx.bezierCurveTo(
      imageWidth * 0.490654,
      imageHeight * 0.53271,
      imageWidth * 0.490654,
      imageHeight * 0.579439,
      imageWidth * 0.490654,
      imageHeight * 0.588785
    );
    ctx.bezierCurveTo(
      imageWidth * 0.485981,
      imageHeight * 0.593457,
      imageWidth * 0.481308,
      imageHeight * 0.59813,
      imageWidth * 0.481308,
      imageHeight * 0.607476
    );
    ctx.bezierCurveTo(
      imageWidth * 0.481308,
      imageHeight * 0.616822,
      imageWidth * 0.490654,
      imageHeight * 0.626168,
      imageWidth * 0.5,
      imageHeight * 0.626168
    );
    ctx.bezierCurveTo(
      imageWidth * 0.509345,
      imageHeight * 0.626168,
      imageWidth * 0.518691,
      imageHeight * 0.616822,
      imageWidth * 0.518691,
      imageHeight * 0.607476
    );
    ctx.bezierCurveTo(
      imageWidth * 0.518691,
      imageHeight * 0.59813,
      imageWidth * 0.514018,
      imageHeight * 0.593457,
      imageWidth * 0.504672,
      imageHeight * 0.588785
    );
    ctx.bezierCurveTo(
      imageWidth * 0.504672,
      imageHeight * 0.579439,
      imageWidth * 0.504672,
      imageHeight * 0.53271,
      imageWidth * 0.509345,
      imageHeight * 0.53271
    );
    ctx.bezierCurveTo(
      imageWidth * 0.523364,
      imageHeight * 0.528037,
      imageWidth * 0.53271,
      imageHeight * 0.514018,
      imageWidth * 0.53271,
      imageHeight * 0.5
    );
    ctx.bezierCurveTo(
      imageWidth * 0.53271,
      imageHeight * 0.490654,
      imageWidth * 0.528037,
      imageHeight * 0.481308,
      imageWidth * 0.518691,
      imageHeight * 0.471962
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  const draw1000ftPointer = function (ctx) {
    const grad = ctx.createLinearGradient(
      0,
      imageHeight * 0.401869,
      0,
      imageHeight * 0.616822
    );
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.51, '#ffffff');
    grad.addColorStop(0.52, '#ffffff');
    grad.addColorStop(0.5201, '#202020');
    grad.addColorStop(0.53, '#202020');
    grad.addColorStop(1, '#202020');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(imageWidth * 0.518691, imageHeight * 0.471962);
    ctx.bezierCurveTo(
      imageWidth * 0.514018,
      imageHeight * 0.462616,
      imageWidth * 0.528037,
      imageHeight * 0.401869,
      imageWidth * 0.528037,
      imageHeight * 0.401869
    );
    ctx.lineTo(imageWidth * 0.5, imageHeight * 0.331775);
    ctx.lineTo(imageWidth * 0.471962, imageHeight * 0.401869);
    ctx.bezierCurveTo(
      imageWidth * 0.471962,
      imageHeight * 0.401869,
      imageWidth * 0.485981,
      imageHeight * 0.462616,
      imageWidth * 0.481308,
      imageHeight * 0.471962
    );
    ctx.bezierCurveTo(
      imageWidth * 0.471962,
      imageHeight * 0.481308,
      imageWidth * 0.467289,
      imageHeight * 0.490654,
      imageWidth * 0.467289,
      imageHeight * 0.5
    );
    ctx.bezierCurveTo(
      imageWidth * 0.467289,
      imageHeight * 0.514018,
      imageWidth * 0.476635,
      imageHeight * 0.528037,
      imageWidth * 0.490654,
      imageHeight * 0.53271
    );
    ctx.bezierCurveTo(
      imageWidth * 0.490654,
      imageHeight * 0.53271,
      imageWidth * 0.462616,
      imageHeight * 0.574766,
      imageWidth * 0.462616,
      imageHeight * 0.593457
    );
    ctx.bezierCurveTo(
      imageWidth * 0.467289,
      imageHeight * 0.616822,
      imageWidth * 0.5,
      imageHeight * 0.612149,
      imageWidth * 0.5,
      imageHeight * 0.612149
    );
    ctx.bezierCurveTo(
      imageWidth * 0.5,
      imageHeight * 0.612149,
      imageWidth * 0.53271,
      imageHeight * 0.616822,
      imageWidth * 0.537383,
      imageHeight * 0.593457
    );
    ctx.bezierCurveTo(
      imageWidth * 0.537383,
      imageHeight * 0.574766,
      imageWidth * 0.509345,
      imageHeight * 0.53271,
      imageWidth * 0.509345,
      imageHeight * 0.53271
    );
    ctx.bezierCurveTo(
      imageWidth * 0.523364,
      imageHeight * 0.528037,
      imageWidth * 0.53271,
      imageHeight * 0.514018,
      imageWidth * 0.53271,
      imageHeight * 0.5
    );
    ctx.bezierCurveTo(
      imageWidth * 0.53271,
      imageHeight * 0.490654,
      imageWidth * 0.528037,
      imageHeight * 0.481308,
      imageWidth * 0.518691,
      imageHeight * 0.471962
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  const draw10000ftPointer = function (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(imageWidth * 0.518691, imageHeight * 0.471962);
    ctx.bezierCurveTo(
      imageWidth * 0.514018,
      imageHeight * 0.471962,
      imageWidth * 0.514018,
      imageHeight * 0.467289,
      imageWidth * 0.514018,
      imageHeight * 0.467289
    );
    ctx.lineTo(imageWidth * 0.514018, imageHeight * 0.317757);
    ctx.lineTo(imageWidth * 0.504672, imageHeight * 0.303738);
    ctx.lineTo(imageWidth * 0.504672, imageHeight * 0.182242);
    ctx.lineTo(imageWidth * 0.53271, imageHeight * 0.116822);
    ctx.lineTo(imageWidth * 0.462616, imageHeight * 0.116822);
    ctx.lineTo(imageWidth * 0.495327, imageHeight * 0.182242);
    ctx.lineTo(imageWidth * 0.495327, imageHeight * 0.299065);
    ctx.lineTo(imageWidth * 0.485981, imageHeight * 0.317757);
    ctx.lineTo(imageWidth * 0.485981, imageHeight * 0.467289);
    ctx.bezierCurveTo(
      imageWidth * 0.485981,
      imageHeight * 0.467289,
      imageWidth * 0.485981,
      imageHeight * 0.471962,
      imageWidth * 0.481308,
      imageHeight * 0.471962
    );
    ctx.bezierCurveTo(
      imageWidth * 0.471962,
      imageHeight * 0.481308,
      imageWidth * 0.467289,
      imageHeight * 0.490654,
      imageWidth * 0.467289,
      imageHeight * 0.5
    );
    ctx.bezierCurveTo(
      imageWidth * 0.467289,
      imageHeight * 0.518691,
      imageWidth * 0.481308,
      imageHeight * 0.53271,
      imageWidth * 0.5,
      imageHeight * 0.53271
    );
    ctx.bezierCurveTo(
      imageWidth * 0.518691,
      imageHeight * 0.53271,
      imageWidth * 0.53271,
      imageHeight * 0.518691,
      imageWidth * 0.53271,
      imageHeight * 0.5
    );
    ctx.bezierCurveTo(
      imageWidth * 0.53271,
      imageHeight * 0.490654,
      imageWidth * 0.528037,
      imageHeight * 0.481308,
      imageWidth * 0.518691,
      imageHeight * 0.471962
    );
    ctx.closePath();
    ctx.fill();
  };

  function calcAngleStep () {
    angleStep100ft = TWO_PI / (maxValue - minValue);
    angleStep1000ft = angleStep100ft / 10;
    angleStep10000ft = angleStep1000ft / 10;
  }

  function calcValues () {
    value100 = (value % 1000) / 100;
    value1000 = (value % 10000) / 100;
    value10000 = (value % 100000) / 100;
  }

  // **************   Initialization  ********************
  // Draw all static painting code to background
  const init = function (parameters) {
    parameters = parameters || {};
    // Parameters
    const drawFrame2 =
      undefined === parameters.frame ? false : parameters.frame;
    const drawBackground2 =
      undefined === parameters.background ? false : parameters.background;
    const drawPointers =
      undefined === parameters.pointers ? false : parameters.pointers;
    const drawForeground2 =
      undefined === parameters.foreground ? false : parameters.foreground;

    initialized = true;

    calcAngleStep();

    // Create frame in frame buffer (backgroundBuffer)
    if (drawFrame2 && frameVisible) {
      drawFrame(
        frameContext,
        frameDesign,
        centerX,
        centerY,
        imageWidth,
        imageHeight
      );
    }

    if (drawBackground2 && backgroundVisible) {
      // Create background in background buffer (backgroundBuffer)
      drawBackground(
        backgroundContext,
        backgroundColor,
        centerX,
        centerY,
        imageWidth,
        imageHeight
      );

      // Create custom layer in background buffer (backgroundBuffer)
      drawRadialCustomImage(
        backgroundContext,
        customLayer,
        centerX,
        centerY,
        imageWidth,
        imageHeight
      );

      // Create tickmarks in background buffer (backgroundBuffer)
      drawTickmarksImage(
        backgroundContext,
        0,
        TICKMARK_OFFSET,
        0,
        10,
        angleStep100ft);

      // Create title in background buffer (backgroundBuffer)
      drawTitleImage(
        backgroundContext,
        imageWidth,
        imageHeight,
        titleString,
        unitString,
        backgroundColor,
        true,
        true,
        unitStringPosY
      );
    }

    // Create lcd background if selected in background buffer (backgroundBuffer)
    if (drawBackground2 && lcdVisible) {
      lcdBuffer = createLcdBackgroundImage(
        imageWidth * 0.4,
        imageHeight * 0.09,
        lcdColor
      );
      backgroundContext.drawImage(
        lcdBuffer,
        (imageWidth - imageWidth * 0.4) / 2,
        imageHeight * 0.56
      );
    }

    if (drawPointers) {
      // Create 100ft pointer in buffer
      draw100ftPointer(pointer100Context, false);
      // Create 1000ft pointer in buffer
      draw1000ftPointer(pointer1000Context);
      // Create 10000ft pointer in buffer
      draw10000ftPointer(pointer10000Context);
    }

    if (drawForeground2 && foregroundVisible) {
      drawForeground(
        foregroundContext,
        foregroundType,
        imageWidth,
        imageHeight,
        true,
        knobType,
        knobStyle
      );
    }
  };

  const repaint = function () {
    if (!initialized) {
      init({
        frame: true,
        background: true,
        led: true,
        pointers: true,
        foreground: true
      });
    }

    // mainCtx.save();
    mainCtx.clearRect(0, 0, mainCtx.canvas.width, mainCtx.canvas.height);

    // Draw frame
    if (frameVisible) {
      mainCtx.drawImage(frameBuffer, 0, 0);
    }

    // Draw buffered image to visible canvas
    mainCtx.drawImage(backgroundBuffer, 0, 0);

    // Draw lcd display
    if (lcdVisible) {
      drawLcdText(value);
    }

    // re-calculate the spearate pointer values
    calcValues();

    let shadowOffset = imageWidth * 0.006 * 0.5;

    mainCtx.save();
    // Draw 10000ft pointer
    // Define rotation center
    mainCtx.translate(centerX, centerY);
    mainCtx.rotate((value10000 - minValue) * angleStep10000ft);
    mainCtx.translate(-centerX, -centerY);
    // Set the pointer shadow params
    mainCtx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    mainCtx.shadowOffsetX = mainCtx.shadowOffsetY = shadowOffset;
    mainCtx.shadowBlur = shadowOffset * 2;
    // Draw the pointer
    mainCtx.drawImage(pointer10000Buffer, 0, 0);

    shadowOffset = imageWidth * 0.006 * 0.75;
    mainCtx.shadowOffsetX = mainCtx.shadowOffsetY = shadowOffset;

    // Draw 1000ft pointer
    mainCtx.translate(centerX, centerY);
    mainCtx.rotate(
      (value1000 - minValue) * angleStep1000ft -
        (value10000 - minValue) * angleStep10000ft
    );
    mainCtx.translate(-centerX, -centerY);
    mainCtx.drawImage(pointer1000Buffer, 0, 0);

    shadowOffset = imageWidth * 0.006;
    mainCtx.shadowOffsetX = mainCtx.shadowOffsetY = shadowOffset;

    // Draw 100ft pointer
    mainCtx.translate(centerX, centerY);
    mainCtx.rotate(
      (value100 - minValue) * angleStep100ft -
        (value1000 - minValue) * angleStep1000ft
    );
    mainCtx.translate(-centerX, -centerY);
    mainCtx.drawImage(pointer100Buffer, 0, 0);
    mainCtx.restore();

    // Draw the foregound
    if (foregroundVisible) {
      mainCtx.drawImage(foregroundBuffer, 0, 0);
    }
  };

  // Visualize the component
  repaint();
}

class AltimeterElement extends BaseElement {
  static get drawFunction () { return drawAltimeter }

  static get properties () {
    return {
      size: { type: Number, defaultValue: 200 },
      value: { type: Number, defaultValue: 0 },
      real_value: { state: true },
      transitionTime: { type: Number, defaultValue: 500 },
      frameDesign: { type: String, objectEnum: FrameDesign, defaultValue: 'METAL' },
      noFrameVisible: { type: Boolean, defaultValue: false },
      backgroundColor: { type: String, objectEnum: BackgroundColor, defaultValue: 'DARK_GRAY' },
      noBackgroundVisible: { type: Boolean, defaultValue: false },
      titleString: { type: String, defaultValue: '' },
      unitString: { type: String, defaultValue: '' },
      unitAltPos: { type: Boolean, defaultValue: false },
      knobType: { type: String, objectEnum: KnobType, defaultValue: 'METAL_KNOB' },
      knobStyle: { type: String, objectEnum: KnobStyle, defaultValue: 'BLACK' },
      lcdColor: { type: String, objectEnum: LcdColor, defaultValue: 'BLACK' },
      noLcdVisible: { type: Boolean, defaultValue: false },
      digitalFont: { type: Boolean, defaultValue: false },
      foregroundType: { type: String, objectEnum: ForegroundType, defaultValue: 'TYPE1' },
      noForegroundVisible: { type: Boolean, defaultValue: false }
    }
  }

  constructor () {
    super();
    this._timer = timer(() => {});
    this._timer.stop();
  }

  connectedCallback () {
    super.connectedCallback();
    this.real_value = this.real_value ?? 0;
  }

  render () {
    return $`
      <canvas width="${this.size}" height="${this.size}"></canvas>
    `
  }

  updated (changedProperties) {
    super.updated();
    if (changedProperties.has('value') || changedProperties.has('transitionTime')) {
      const transitionTime = this.transitionTime;
      const originTime = now();
      const originValue = this.real_value;
      const targetValue = this.value;
      const timeScale = transitionTime <= 0 ? () => 1 : linear().domain([0, transitionTime]).clamp(true);
      const valueScale = linear().range([originValue, targetValue]).clamp(true);
      this._timer.restart((elapsedTime) => {
        const scaled = timeScale(elapsedTime);
        const eased = cubicInOut(scaled);
        const newValue = valueScale(eased);
        this.real_value = newValue;
        if (now() >= originTime + transitionTime) {
          this._timer.stop();
        }
      });
    }
  }
}

window.customElements.define('steelseries-altimeter', AltimeterElement);

function drawTrafficlight (canvas, parameters) {
  parameters = parameters || {};
  let width = undefined === parameters.width ? 0 : parameters.width;
  let height = undefined === parameters.height ? 0 : parameters.height;
  //
  const mainCtx = getCanvasContext(canvas);
  const redOn = parameters.redOn ?? false;
  const yellowOn = parameters.yellowOn ?? false;
  const greenOn = parameters.greenOn ?? false;
  let initialized = false;
  const housingBuffer = doc.createElement('canvas');
  const housingCtx = housingBuffer.getContext('2d');
  const lightGreenBuffer = doc.createElement('canvas');
  const lightGreenCtx = lightGreenBuffer.getContext('2d');
  const greenOnBuffer = doc.createElement('canvas');
  const greenOnCtx = greenOnBuffer.getContext('2d');
  const greenOffBuffer = doc.createElement('canvas');
  const greenOffCtx = greenOffBuffer.getContext('2d');
  const lightYellowBuffer = doc.createElement('canvas');
  const lightYellowCtx = lightYellowBuffer.getContext('2d');
  const yellowOnBuffer = doc.createElement('canvas');
  const yellowOnCtx = yellowOnBuffer.getContext('2d');
  const yellowOffBuffer = doc.createElement('canvas');
  const yellowOffCtx = yellowOffBuffer.getContext('2d');
  const lightRedBuffer = doc.createElement('canvas');
  const lightRedCtx = lightRedBuffer.getContext('2d');
  const redOnBuffer = doc.createElement('canvas');
  const redOnCtx = redOnBuffer.getContext('2d');
  const redOffBuffer = doc.createElement('canvas');
  const redOffCtx = redOffBuffer.getContext('2d');
  // End of variables

  // Has a size been specified?
  if (width === 0) {
    width = mainCtx.canvas.width;
  }
  if (height === 0) {
    height = mainCtx.canvas.height;
  }

  // Set the size - also clears the canvas
  mainCtx.canvas.width = width;
  mainCtx.canvas.height = height;

  const prefHeight = width < height * 0.352517 ? width * 2.836734 : height;
  const imageWidth = prefHeight * 0.352517;
  const imageHeight = prefHeight;

  housingBuffer.width = imageWidth;
  housingBuffer.height = imageHeight;

  lightGreenBuffer.width = imageWidth;
  lightGreenBuffer.height = imageHeight;

  greenOnBuffer.width = imageWidth;
  greenOnBuffer.height = imageHeight;

  greenOffBuffer.width = imageWidth;
  greenOffBuffer.height = imageHeight;

  lightYellowBuffer.width = imageWidth;
  lightYellowBuffer.height = imageHeight;

  yellowOnBuffer.width = imageWidth;
  yellowOnBuffer.height = imageHeight;

  yellowOffBuffer.width = imageWidth;
  yellowOffBuffer.height = imageHeight;

  lightRedBuffer.width = imageWidth;
  lightRedBuffer.height = imageHeight;

  redOnBuffer.width = imageWidth;
  redOnBuffer.height = imageHeight;

  redOffBuffer.width = imageWidth;
  redOffBuffer.height = imageHeight;

  const drawHousing = function (ctx) {
    ctx.save();

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0.107142 * imageWidth, 0);
    ctx.lineTo(imageWidth - 0.107142 * imageWidth, 0);
    ctx.quadraticCurveTo(imageWidth, 0, imageWidth, 0.107142 * imageWidth);
    ctx.lineTo(imageWidth, imageHeight - 0.107142 * imageWidth);
    ctx.quadraticCurveTo(
      imageWidth,
      imageHeight,
      imageWidth - 0.107142 * imageWidth,
      imageHeight
    );
    ctx.lineTo(0.107142 * imageWidth, imageHeight);
    ctx.quadraticCurveTo(
      0,
      imageHeight,
      0,
      imageHeight - 0.107142 * imageWidth
    );
    ctx.lineTo(0, 0.107142 * imageWidth);
    ctx.quadraticCurveTo(0, 0, 0.107142 * imageWidth, imageHeight);
    ctx.closePath();
    const housingFill = ctx.createLinearGradient(
      0.040816 * imageWidth,
      0.007194 * imageHeight,
      0.952101 * imageWidth,
      0.995882 * imageHeight
    );
    housingFill.addColorStop(0, 'rgb(152, 152, 154)');
    housingFill.addColorStop(0.01, 'rgb(152, 152, 154)');
    housingFill.addColorStop(0.09, '#333333');
    housingFill.addColorStop(0.24, 'rgb(152, 152, 154)');
    housingFill.addColorStop(0.55, 'rgb(31, 31, 31)');
    housingFill.addColorStop(0.78, '#363636');
    housingFill.addColorStop(0.98, '#000000');
    housingFill.addColorStop(1, '#000000');
    ctx.fillStyle = housingFill;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(
      0.030612 * imageWidth + 0.084183 * imageWidth,
      0.010791 * imageHeight
    );
    ctx.lineTo(
      0.030612 * imageWidth + 0.938775 * imageWidth - 0.084183 * imageWidth,
      0.010791 * imageHeight
    );
    ctx.quadraticCurveTo(
      0.030612 * imageWidth + 0.938775 * imageWidth,
      0.010791 * imageHeight,
      0.030612 * imageWidth + 0.938775 * imageWidth,
      0.010791 * imageHeight + 0.084183 * imageWidth
    );
    ctx.lineTo(
      0.030612 * imageWidth + 0.938775 * imageWidth,
      0.010791 * imageHeight + 0.978417 * imageHeight - 0.084183 * imageWidth
    );
    ctx.quadraticCurveTo(
      0.030612 * imageWidth + 0.938775 * imageWidth,
      0.010791 * imageHeight + 0.978417 * imageHeight,
      0.030612 * imageWidth + 0.938775 * imageWidth - 0.084183 * imageWidth,
      0.010791 * imageHeight + 0.978417 * imageHeight
    );
    ctx.lineTo(
      0.030612 * imageWidth + 0.084183 * imageWidth,
      0.010791 * imageHeight + 0.978417 * imageHeight
    );
    ctx.quadraticCurveTo(
      0.030612 * imageWidth,
      0.010791 * imageHeight + 0.978417 * imageHeight,
      0.030612 * imageWidth,
      0.010791 * imageHeight + 0.978417 * imageHeight - 0.084183 * imageWidth
    );
    ctx.lineTo(
      0.030612 * imageWidth,
      0.010791 * imageHeight + 0.084183 * imageWidth
    );
    ctx.quadraticCurveTo(
      0.030612 * imageWidth,
      0.010791 * imageHeight,
      0.030612 * imageWidth + 0.084183 * imageWidth,
      0.010791 * imageHeight
    );
    ctx.closePath();
    const housingFrontFill = ctx.createLinearGradient(
      -0.132653 * imageWidth,
      -0.053956 * imageHeight,
      2.061408 * imageWidth,
      0.667293 * imageHeight
    );
    housingFrontFill.addColorStop(0, '#000000');
    housingFrontFill.addColorStop(0.01, '#000000');
    housingFrontFill.addColorStop(0.16, '#373735');
    housingFrontFill.addColorStop(0.31, '#000000');
    housingFrontFill.addColorStop(0.44, '#303030');
    housingFrontFill.addColorStop(0.65, '#000000');
    housingFrontFill.addColorStop(0.87, '#363636');
    housingFrontFill.addColorStop(0.98, '#000000');
    housingFrontFill.addColorStop(1, '#000000');
    ctx.fillStyle = housingFrontFill;
    ctx.fill();
    ctx.restore();

    ctx.restore();
  };

  const drawLightGreen = function (ctx) {
    ctx.save();

    ctx.save();
    ctx.scale(1, 1);
    ctx.beginPath();
    ctx.arc(
      0.5 * imageWidth,
      0.805755 * imageHeight,
      0.397959 * imageWidth,
      0,
      TWO_PI,
      false
    );
    const lightGreenFrameFill = ctx.createLinearGradient(
      0,
      0.665467 * imageHeight,
      0,
      0.946043 * imageHeight
    );
    lightGreenFrameFill.addColorStop(0, '#ffffff');
    lightGreenFrameFill.addColorStop(0.05, 'rgb(204, 204, 204)');
    lightGreenFrameFill.addColorStop(0.1, 'rgb(153, 153, 153)');
    lightGreenFrameFill.addColorStop(0.17, '#666666');
    lightGreenFrameFill.addColorStop(0.27, '#333333');
    lightGreenFrameFill.addColorStop(1, '#010101');
    ctx.fillStyle = lightGreenFrameFill;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.scale(1.083333, 1);
    ctx.beginPath();
    ctx.arc(
      0.461538 * imageWidth,
      0.816546 * imageHeight,
      0.367346 * imageWidth,
      0,
      TWO_PI,
      false
    );
    const lightGreenInnerFill = ctx.createLinearGradient(
      0,
      0.68705 * imageHeight,
      0,
      0.946043 * imageHeight
    );
    lightGreenInnerFill.addColorStop(0, '#000000');
    lightGreenInnerFill.addColorStop(0.35, '#040404');
    lightGreenInnerFill.addColorStop(0.66, '#000000');
    lightGreenInnerFill.addColorStop(1, '#010101');
    ctx.fillStyle = lightGreenInnerFill;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.scale(1, 1);
    ctx.beginPath();
    ctx.arc(
      0.5 * imageWidth,
      0.809352 * imageHeight,
      0.357142 * imageWidth,
      0,
      TWO_PI,
      false
    );
    const lightGreenEffectFill = ctx.createRadialGradient(
      0.5 * imageWidth,
      0.809352 * imageHeight,
      0,
      0.5 * imageWidth,
      0.809352 * imageHeight,
      0.362244 * imageWidth
    );
    lightGreenEffectFill.addColorStop(0, '#000000');
    lightGreenEffectFill.addColorStop(0.88, '#000000');
    lightGreenEffectFill.addColorStop(0.95, 'rgb(94, 94, 94)');
    lightGreenEffectFill.addColorStop(1, '#010101');
    ctx.fillStyle = lightGreenEffectFill;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.scale(1, 1);
    ctx.beginPath();
    ctx.arc(
      0.5 * imageWidth,
      0.809352 * imageHeight,
      0.357142 * imageWidth,
      0,
      TWO_PI,
      false
    );
    const lightGreenInnerShadowFill = ctx.createLinearGradient(
      0,
      0.68705 * imageHeight,
      0,
      0.917266 * imageHeight
    );
    lightGreenInnerShadowFill.addColorStop(0, '#000000');
    lightGreenInnerShadowFill.addColorStop(1, 'rgba(1, 1, 1, 0)');
    ctx.fillStyle = lightGreenInnerShadowFill;
    ctx.fill();
    ctx.restore();
    ctx.restore();
  };

  const drawGreenOn = function (ctx) {
    ctx.save();

    ctx.save();
    ctx.scale(1, 1);
    ctx.beginPath();
    ctx.arc(
      0.5 * imageWidth,
      0.809352 * imageHeight,
      0.32653 * imageWidth,
      0,
      TWO_PI,
      false
    );
    const greenOnFill = ctx.createRadialGradient(
      0.5 * imageWidth,
      0.809352 * imageHeight,
      0,
      0.5 * imageWidth,
      0.809352 * imageHeight,
      0.32653 * imageWidth
    );
    greenOnFill.addColorStop(0, 'rgb(85, 185, 123)');
    greenOnFill.addColorStop(1, 'rgb(0, 31, 0)');
    ctx.fillStyle = greenOnFill;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0.812949 * imageHeight);
    ctx.bezierCurveTo(
      0,
      0.910071 * imageHeight,
      0.224489 * imageWidth,
      0.989208 * imageHeight,
      0.5 * imageWidth,
      0.989208 * imageHeight
    );
    ctx.bezierCurveTo(
      0.77551 * imageWidth,
      0.989208 * imageHeight,
      imageWidth,
      0.910071 * imageHeight,
      imageWidth,
      0.809352 * imageHeight
    );
    ctx.bezierCurveTo(
      0.908163 * imageWidth,
      0.751798 * imageHeight,
      0.704081 * imageWidth,
      0.68705 * imageHeight,
      0.5 * imageWidth,
      0.68705 * imageHeight
    );
    ctx.bezierCurveTo(
      0.285714 * imageWidth,
      0.68705 * imageHeight,
      0.081632 * imageWidth,
      0.751798 * imageHeight,
      0,
      0.812949 * imageHeight
    );
    ctx.closePath();
    const greenOnGlowFill = ctx.createRadialGradient(
      0.5 * imageWidth,
      0.809352 * imageHeight,
      0,
      0.5 * imageWidth,
      0.809352 * imageHeight,
      0.515306 * imageWidth
    );
    greenOnGlowFill.addColorStop(0, 'rgb(65, 187, 126)');
    greenOnGlowFill.addColorStop(1, 'rgba(4, 37, 8, 0)');
    ctx.fillStyle = greenOnGlowFill;
    ctx.fill();
    ctx.restore();
    ctx.restore();
  };

  const drawGreenOff = function (ctx) {
    ctx.save();

    ctx.save();
    ctx.scale(1, 1);
    ctx.beginPath();
    ctx.arc(
      0.5 * imageWidth,
      0.809352 * imageHeight,
      0.32653 * imageWidth,
      0,
      TWO_PI,
      false
    );
    const greenOffFill = ctx.createRadialGradient(
      0.5 * imageWidth,
      0.809352 * imageHeight,
      0,
      0.5 * imageWidth,
      0.809352 * imageHeight,
      0.32653 * imageWidth
    );
    greenOffFill.addColorStop(0, 'rgba(0, 255, 0, 0.25)');
    greenOffFill.addColorStop(1, 'rgba(0, 255, 0, 0.05)');
    ctx.fillStyle = greenOffFill;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.scale(1, 1);
    ctx.beginPath();
    ctx.arc(
      0.5 * imageWidth,
      0.809352 * imageHeight,
      0.32653 * imageWidth,
      0,
      TWO_PI,
      false
    );
    const greenOffInnerShadowFill = ctx.createRadialGradient(
      0.5 * imageWidth,
      0.809352 * imageHeight,
      0,
      0.5 * imageWidth,
      0.809352 * imageHeight,
      0.32653 * imageWidth
    );
    greenOffInnerShadowFill.addColorStop(0, 'rgba(1, 1, 1, 0)');
    greenOffInnerShadowFill.addColorStop(0.55, 'rgba(0, 0, 0, 0)');
    greenOffInnerShadowFill.addColorStop(0.5501, 'rgba(0, 0, 0, 0)');
    greenOffInnerShadowFill.addColorStop(0.78, 'rgba(0, 0, 0, 0.12)');
    greenOffInnerShadowFill.addColorStop(0.79, 'rgba(0, 0, 0, 0.12)');
    greenOffInnerShadowFill.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
    ctx.fillStyle = greenOffInnerShadowFill;
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = ctx.createPattern(hatchBuffer, 'repeat');
    ctx.fill();

    ctx.restore();
  };

  const drawLightYellow = function (ctx) {
    ctx.save();

    ctx.save();
    ctx.scale(1, 1);
    ctx.beginPath();
    ctx.arc(
      0.5 * imageWidth,
      0.496402 * imageHeight,
      0.397959 * imageWidth,
      0,
      TWO_PI,
      false
    );
    const lightYellowFrameFill = ctx.createLinearGradient(
      0,
      0.356115 * imageHeight,
      0,
      0.63669 * imageHeight
    );
    lightYellowFrameFill.addColorStop(0, '#ffffff');
    lightYellowFrameFill.addColorStop(0.05, 'rgb(204, 204, 204)');
    lightYellowFrameFill.addColorStop(0.1, 'rgb(153, 153, 153)');
    lightYellowFrameFill.addColorStop(0.17, '#666666');
    lightYellowFrameFill.addColorStop(0.27, '#333333');
    lightYellowFrameFill.addColorStop(1, '#010101');
    ctx.fillStyle = lightYellowFrameFill;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.scale(1.083333, 1);
    ctx.beginPath();
    ctx.arc(
      0.461538 * imageWidth,
      0.507194 * imageHeight,
      0.367346 * imageWidth,
      0,
      TWO_PI,
      false
    );
    const lightYellowInnerFill = ctx.createLinearGradient(
      0,
      0.377697 * imageHeight,
      0,
      0.63669 * imageHeight
    );
    lightYellowInnerFill.addColorStop(0, '#000000');
    lightYellowInnerFill.addColorStop(0.35, '#040404');
    lightYellowInnerFill.addColorStop(0.66, '#000000');
    lightYellowInnerFill.addColorStop(1, '#010101');
    ctx.fillStyle = lightYellowInnerFill;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.scale(1, 1);
    ctx.beginPath();
    ctx.arc(
      0.5 * imageWidth,
      0.5 * imageHeight,
      0.357142 * imageWidth,
      0,
      TWO_PI,
      false
    );
    const lightYellowEffectFill = ctx.createRadialGradient(
      0.5 * imageWidth,
      0.5 * imageHeight,
      0,
      0.5 * imageWidth,
      0.5 * imageHeight,
      0.362244 * imageWidth
    );
    lightYellowEffectFill.addColorStop(0, '#000000');
    lightYellowEffectFill.addColorStop(0.88, '#000000');
    lightYellowEffectFill.addColorStop(0.95, '#5e5e5e');
    lightYellowEffectFill.addColorStop(1, '#010101');
    ctx.fillStyle = lightYellowEffectFill;
    ctx.fill();
    ctx.restore();

    // lIGHT_YELLOW_4_E_INNER_SHADOW_3_4
    ctx.save();
    ctx.scale(1, 1);
    ctx.beginPath();
    ctx.arc(
      0.5 * imageWidth,
      0.5 * imageHeight,
      0.357142 * imageWidth,
      0,
      TWO_PI,
      false
    );
    const lightYellowInnerShadowFill = ctx.createLinearGradient(
      0,
      0.377697 * imageHeight,
      0,
      0.607913 * imageHeight
    );
    lightYellowInnerShadowFill.addColorStop(0, '#000000');
    lightYellowInnerShadowFill.addColorStop(1, 'rgba(1, 1, 1, 0)');
    ctx.fillStyle = lightYellowInnerShadowFill;
    ctx.fill();
    ctx.restore();
    ctx.restore();
  };

  const drawYellowOn = function (ctx) {
    ctx.save();

    ctx.save();
    ctx.scale(1, 1);
    ctx.beginPath();
    ctx.arc(
      0.5 * imageWidth,
      0.5 * imageHeight,
      0.32653 * imageWidth,
      0,
      TWO_PI,
      false
    );
    const yellowOnFill = ctx.createRadialGradient(
      0.5 * imageWidth,
      0.5 * imageHeight,
      0,
      0.5 * imageWidth,
      0.5 * imageHeight,
      0.32653 * imageWidth
    );
    yellowOnFill.addColorStop(0, '#fed434');
    yellowOnFill.addColorStop(1, '#82330c');
    ctx.fillStyle = yellowOnFill;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0.503597 * imageHeight);
    ctx.bezierCurveTo(
      0,
      0.600719 * imageHeight,
      0.224489 * imageWidth,
      0.679856 * imageHeight,
      0.5 * imageWidth,
      0.679856 * imageHeight
    );
    ctx.bezierCurveTo(
      0.77551 * imageWidth,
      0.679856 * imageHeight,
      imageWidth,
      0.600719 * imageHeight,
      imageWidth,
      0.5 * imageHeight
    );
    ctx.bezierCurveTo(
      0.908163 * imageWidth,
      0.442446 * imageHeight,
      0.704081 * imageWidth,
      0.377697 * imageHeight,
      0.5 * imageWidth,
      0.377697 * imageHeight
    );
    ctx.bezierCurveTo(
      0.285714 * imageWidth,
      0.377697 * imageHeight,
      0.081632 * imageWidth,
      0.442446 * imageHeight,
      0,
      0.503597 * imageHeight
    );
    ctx.closePath();
    const yellowOnGlowFill = ctx.createRadialGradient(
      0.5 * imageWidth,
      0.5 * imageHeight,
      0,
      0.5 * imageWidth,
      0.5 * imageHeight,
      0.515306 * imageWidth
    );
    yellowOnGlowFill.addColorStop(0, '#fed434');
    yellowOnGlowFill.addColorStop(1, 'rgba(130, 51, 12, 0)');
    ctx.fillStyle = yellowOnGlowFill;
    ctx.fill();
    ctx.restore();
    ctx.restore();
  };

  const drawYellowOff = function (ctx) {
    ctx.save();

    ctx.save();
    ctx.scale(1, 1);
    ctx.beginPath();
    ctx.arc(
      0.5 * imageWidth,
      0.5 * imageHeight,
      0.32653 * imageWidth,
      0,
      TWO_PI,
      false
    );
    const yellowOffFill = ctx.createRadialGradient(
      0.5 * imageWidth,
      0.5 * imageHeight,
      0,
      0.5 * imageWidth,
      0.5 * imageHeight,
      0.32653 * imageWidth
    );
    yellowOffFill.addColorStop(0, 'rgba(255, 255, 0, 0.25)');
    yellowOffFill.addColorStop(1, 'rgba(255, 255, 0, 0.05)');
    ctx.fillStyle = yellowOffFill;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.scale(1, 1);
    ctx.beginPath();
    ctx.arc(
      0.5 * imageWidth,
      0.5 * imageHeight,
      0.32653 * imageWidth,
      0,
      TWO_PI,
      false
    );
    const yellowOffInnerShadowFill = ctx.createRadialGradient(
      0.5 * imageWidth,
      0.5 * imageHeight,
      0,
      0.5 * imageWidth,
      0.5 * imageHeight,
      0.32653 * imageWidth
    );
    yellowOffInnerShadowFill.addColorStop(0, 'rgba(1, 1, 1, 0)');
    yellowOffInnerShadowFill.addColorStop(0.55, 'rgba(0, 0, 0, 0)');
    yellowOffInnerShadowFill.addColorStop(0.5501, 'rgba(0, 0, 0, 0)');
    yellowOffInnerShadowFill.addColorStop(0.78, 'rgba(0, 0, 0, 0.12)');
    yellowOffInnerShadowFill.addColorStop(0.79, 'rgba(0, 0, 0, 0.13)');
    yellowOffInnerShadowFill.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
    ctx.fillStyle = yellowOffInnerShadowFill;
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = ctx.createPattern(hatchBuffer, 'repeat');
    ctx.fill();

    ctx.restore();
  };

  const drawLightRed = function (ctx) {
    ctx.save();

    // lIGHT_RED_7_E_FRAME_0_1
    ctx.save();
    ctx.scale(1, 1);
    ctx.beginPath();
    ctx.arc(
      0.5 * imageWidth,
      0.18705 * imageHeight,
      0.397959 * imageWidth,
      0,
      TWO_PI,
      false
    );
    const lightRedFrameFill = ctx.createLinearGradient(
      0.5 * imageWidth,
      0.046762 * imageHeight,
      0.5 * imageWidth,
      0.327338 * imageHeight
    );
    lightRedFrameFill.addColorStop(0, '#ffffff');
    lightRedFrameFill.addColorStop(0.05, '#cccccc');
    lightRedFrameFill.addColorStop(0.1, '#999999');
    lightRedFrameFill.addColorStop(0.17, '#666666');
    lightRedFrameFill.addColorStop(0.27, '#333333');
    lightRedFrameFill.addColorStop(1, '#010101');
    ctx.fillStyle = lightRedFrameFill;
    ctx.fill();
    ctx.restore();

    // lIGHT_RED_7_E_INNER_CLIP_1_2
    ctx.save();
    ctx.scale(1.083333, 1);
    ctx.beginPath();
    ctx.arc(
      0.461538 * imageWidth,
      0.197841 * imageHeight,
      0.367346 * imageWidth,
      0,
      TWO_PI,
      false
    );
    const lightRedInnerFill = ctx.createLinearGradient(
      0.5 * imageWidth,
      0.068345 * imageHeight,
      0.5 * imageWidth,
      0.327338 * imageHeight
    );
    lightRedInnerFill.addColorStop(0, '#000000');
    lightRedInnerFill.addColorStop(0.35, '#040404');
    lightRedInnerFill.addColorStop(0.66, '#000000');
    lightRedInnerFill.addColorStop(1, '#010101');
    ctx.fillStyle = lightRedInnerFill;
    ctx.fill();
    ctx.restore();

    // lIGHT_RED_7_E_LIGHT_EFFECT_2_3
    ctx.save();
    ctx.scale(1, 1);
    ctx.beginPath();
    ctx.arc(
      0.5 * imageWidth,
      0.190647 * imageHeight,
      0.357142 * imageWidth,
      0,
      TWO_PI,
      false
    );
    const lightRedEffectFill = ctx.createRadialGradient(
      0.5 * imageWidth,
      0.190647 * imageHeight,
      0,
      0.5 * imageWidth,
      0.190647 * imageHeight,
      0.362244 * imageWidth
    );
    lightRedEffectFill.addColorStop(0, '#000000');
    lightRedEffectFill.addColorStop(0.88, '#000000');
    lightRedEffectFill.addColorStop(0.95, '#5e5e5e');
    lightRedEffectFill.addColorStop(1, '#010101');
    ctx.fillStyle = lightRedEffectFill;
    ctx.fill();
    ctx.restore();

    // lIGHT_RED_7_E_INNER_SHADOW_3_4
    ctx.save();
    ctx.scale(1, 1);
    ctx.beginPath();
    ctx.arc(
      0.5 * imageWidth,
      0.190647 * imageHeight,
      0.357142 * imageWidth,
      0,
      TWO_PI,
      false
    );
    const lightRedInnerShadowFill = ctx.createLinearGradient(
      0.5 * imageWidth,
      0.068345 * imageHeight,
      0.5 * imageWidth,
      0.298561 * imageHeight
    );
    lightRedInnerShadowFill.addColorStop(0, '#000000');
    lightRedInnerShadowFill.addColorStop(1, 'rgba(1, 1, 1, 0)');
    ctx.fillStyle = lightRedInnerShadowFill;
    ctx.fill();
    ctx.restore();
    ctx.restore();
  };

  const drawRedOn = function (ctx) {
    ctx.save();

    ctx.save();
    ctx.scale(1, 1);
    ctx.beginPath();
    ctx.arc(
      0.5 * imageWidth,
      0.190647 * imageHeight,
      0.32653 * imageWidth,
      0,
      TWO_PI,
      false
    );
    const redOnFill = ctx.createRadialGradient(
      0.5 * imageWidth,
      0.190647 * imageHeight,
      0,
      0.5 * imageWidth,
      0.190647 * imageHeight,
      0.32653 * imageWidth
    );
    redOnFill.addColorStop(0, '#ff0000');
    redOnFill.addColorStop(1, '#410004');
    ctx.fillStyle = redOnFill;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0.194244 * imageHeight);
    ctx.bezierCurveTo(
      0,
      0.291366 * imageHeight,
      0.224489 * imageWidth,
      0.370503 * imageHeight,
      0.5 * imageWidth,
      0.370503 * imageHeight
    );
    ctx.bezierCurveTo(
      0.77551 * imageWidth,
      0.370503 * imageHeight,
      imageWidth,
      0.291366 * imageHeight,
      imageWidth,
      0.190647 * imageHeight
    );
    ctx.bezierCurveTo(
      0.908163 * imageWidth,
      0.133093 * imageHeight,
      0.704081 * imageWidth,
      0.068345 * imageHeight,
      0.5 * imageWidth,
      0.068345 * imageHeight
    );
    ctx.bezierCurveTo(
      0.285714 * imageWidth,
      0.068345 * imageHeight,
      0.081632 * imageWidth,
      0.133093 * imageHeight,
      0,
      0.194244 * imageHeight
    );
    ctx.closePath();
    const redOnGlowFill = ctx.createRadialGradient(
      0.5 * imageWidth,
      0.190647 * imageHeight,
      0,
      0.5 * imageWidth,
      0.190647 * imageHeight,
      0.515306 * imageWidth
    );
    redOnGlowFill.addColorStop(0, '#ff0000');
    redOnGlowFill.addColorStop(1, 'rgba(118, 5, 1, 0)');
    ctx.fillStyle = redOnGlowFill;
    ctx.fill();
    ctx.restore();

    ctx.restore();
  };

  const drawRedOff = function (ctx) {
    ctx.save();

    ctx.save();
    ctx.scale(1, 1);
    ctx.beginPath();
    ctx.arc(
      0.5 * imageWidth,
      0.190647 * imageHeight,
      0.32653 * imageWidth,
      0,
      TWO_PI,
      false
    );
    const redOffFill = ctx.createRadialGradient(
      0.5 * imageWidth,
      0.190647 * imageHeight,
      0,
      0.5 * imageWidth,
      0.190647 * imageHeight,
      0.32653 * imageWidth
    );
    redOffFill.addColorStop(0, 'rgba(255, 0, 0, 0.25)');
    redOffFill.addColorStop(1, 'rgba(255, 0, 0, 0.05)');
    ctx.fillStyle = redOffFill;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.scale(1, 1);
    ctx.beginPath();
    ctx.arc(
      0.5 * imageWidth,
      0.190647 * imageHeight,
      0.32653 * imageWidth,
      0,
      TWO_PI,
      false
    );
    const redOffInnerShadowFill = ctx.createRadialGradient(
      0.5 * imageWidth,
      0.190647 * imageHeight,
      0,
      0.5 * imageWidth,
      0.190647 * imageHeight,
      0.32653 * imageWidth
    );
    redOffInnerShadowFill.addColorStop(0, 'rgba(1, 1, 1, 0)');
    redOffInnerShadowFill.addColorStop(0.55, 'rgba(0, 0, 0, 0)');
    redOffInnerShadowFill.addColorStop(0.5501, 'rgba(0, 0, 0, 0)');
    redOffInnerShadowFill.addColorStop(0.78, 'rgba(0, 0, 0, 0.12)');
    redOffInnerShadowFill.addColorStop(0.79, 'rgba(0, 0, 0, 0.13)');
    redOffInnerShadowFill.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
    ctx.fillStyle = redOffInnerShadowFill;
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = ctx.createPattern(hatchBuffer, 'repeat');
    ctx.fill();

    ctx.restore();
  };

  function drawToBuffer (width, height, drawFunction) {
    const buffer = doc.createElement('canvas');
    buffer.width = width;
    buffer.height = height;
    drawFunction(buffer.getContext('2d'));
    return buffer
  }

  const hatchBuffer = drawToBuffer(2, 2, function (ctx) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.beginPath();
    ctx.lineTo(0, 0, 1, 0);
    ctx.lineTo(0, 1, 0, 1);
    ctx.stroke();
    ctx.restore();
  });

  const init = function () {
    initialized = true;

    drawHousing(housingCtx);
    drawLightGreen(lightGreenCtx);
    drawGreenOn(greenOnCtx);
    drawGreenOff(greenOffCtx);
    drawLightYellow(lightYellowCtx);
    drawYellowOn(yellowOnCtx);
    drawYellowOff(yellowOffCtx);
    drawLightRed(lightRedCtx);
    drawRedOn(redOnCtx);
    drawRedOff(redOffCtx);
  };

  const repaint = function () {
    if (!initialized) {
      init();
    }

    mainCtx.save();
    mainCtx.clearRect(0, 0, mainCtx.canvas.width, mainCtx.canvas.height);

    // housing
    mainCtx.drawImage(housingBuffer, 0, 0);

    // Green light
    mainCtx.drawImage(lightGreenBuffer, 0, 0);

    if (greenOn) {
      mainCtx.drawImage(greenOnBuffer, 0, 0);
    }

    mainCtx.drawImage(greenOffBuffer, 0, 0);

    // Yellow light
    mainCtx.drawImage(lightYellowBuffer, 0, 0);

    if (yellowOn) {
      mainCtx.drawImage(yellowOnBuffer, 0, 0);
    }

    mainCtx.drawImage(yellowOffBuffer, 0, 0);

    // Red light
    mainCtx.drawImage(lightRedBuffer, 0, 0);

    if (redOn) {
      mainCtx.drawImage(redOnBuffer, 0, 0);
    }

    mainCtx.drawImage(redOffBuffer, 0, 0);
    mainCtx.restore();
  };

  // Visualize the component
  repaint();
}

class TrafficlightElement extends BaseElement {
  static get drawFunction () { return drawTrafficlight }

  static get properties () {
    return {
      width: { type: Number, defaultValue: 75 },
      height: { type: Number, defaultValue: 200 },
      greenOn: { type: Boolean, defaultValue: false },
      yellowOn: { type: Boolean, defaultValue: false },
      redOn: { type: Boolean, defaultValue: false }
    }
  }

  render () {
    return $`
      <canvas width="${this.width}" height="${this.height}"></canvas>
    `
  }
}

window.customElements.define('steelseries-trafficlight', TrafficlightElement);

function drawLightbulb (canvas, parameters) {
  parameters = parameters || {};
  // parameters
  let width = undefined === parameters.width ? 0 : parameters.width;
  let height = undefined === parameters.height ? 0 : parameters.height;
  const glowColor =
    undefined === parameters.glowColor ? '#ffff00' : parameters.glowColor;
  //
  let initialized = false;
  const lightOn = parameters.lightOn ?? false;
  const alpha = 1;
  const offBuffer = doc.createElement('canvas');
  const offCtx = offBuffer.getContext('2d');
  const onBuffer = doc.createElement('canvas');
  const onCtx = onBuffer.getContext('2d');
  const bulbBuffer = doc.createElement('canvas');
  const bulbCtx = bulbBuffer.getContext('2d');
  // End of variables

  // Get the canvas context and clear it
  const mainCtx = getCanvasContext(canvas);

  // Has a size been specified?
  if (width === 0) {
    width = mainCtx.canvas.width;
  }
  if (height === 0) {
    height = mainCtx.canvas.height;
  }

  // Get the size
  mainCtx.canvas.width = width;
  mainCtx.canvas.height = height;
  const size = width < height ? width : height;
  const imageWidth = size;
  const imageHeight = size;

  function drawToBuffer (width, height, drawFunction) {
    const buffer = doc.createElement('canvas');
    buffer.width = width;
    buffer.height = height;
    drawFunction(buffer.getContext('2d'));
    return buffer
  }

  const getColorValues = function (color) {
    const lookupBuffer = drawToBuffer(1, 1, function (ctx) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.rect(0, 0, 1, 1);
      ctx.fill();
    });

    const colorData = lookupBuffer.getContext('2d').getImageData(0, 0, 2, 2).data;
    return [colorData[0], colorData[1], colorData[2]]
  };

  offBuffer.width = imageWidth;
  offBuffer.height = imageHeight;

  onBuffer.width = imageWidth;
  onBuffer.height = imageHeight;

  bulbBuffer.width = imageWidth;
  bulbBuffer.height = imageHeight;

  const drawOff = function (ctx) {
    ctx.save();

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0.289473 * imageWidth, 0.438596 * imageHeight);
    ctx.bezierCurveTo(
      0.289473 * imageWidth,
      0.561403 * imageHeight,
      0.385964 * imageWidth,
      0.605263 * imageHeight,
      0.385964 * imageWidth,
      0.745614 * imageHeight
    );
    ctx.bezierCurveTo(
      0.385964 * imageWidth,
      0.745614 * imageHeight,
      0.587719 * imageWidth,
      0.745614 * imageHeight,
      0.587719 * imageWidth,
      0.745614 * imageHeight
    );
    ctx.bezierCurveTo(
      0.587719 * imageWidth,
      0.605263 * imageHeight,
      0.692982 * imageWidth,
      0.561403 * imageHeight,
      0.692982 * imageWidth,
      0.438596 * imageHeight
    );
    ctx.bezierCurveTo(
      0.692982 * imageWidth,
      0.324561 * imageHeight,
      0.605263 * imageWidth,
      0.22807 * imageHeight,
      0.5 * imageWidth,
      0.22807 * imageHeight
    );
    ctx.bezierCurveTo(
      0.385964 * imageWidth,
      0.22807 * imageHeight,
      0.289473 * imageWidth,
      0.324561 * imageHeight,
      0.289473 * imageWidth,
      0.438596 * imageHeight
    );
    ctx.closePath();
    const glassOffFill = ctx.createLinearGradient(
      0,
      0.289473 * imageHeight,
      0,
      0.701754 * imageHeight
    );
    glassOffFill.addColorStop(0, '#eeeeee');
    glassOffFill.addColorStop(0.99, '#999999');
    glassOffFill.addColorStop(1, '#999999');
    ctx.fillStyle = glassOffFill;
    ctx.fill();
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 0.008771 * imageWidth;
    ctx.strokeStyle = '#cccccc';
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  };

  const drawOn = function (ctx) {
    const data = getColorValues(glowColor);
    const red = data[0];
    const green = data[1];
    const blue = data[2];
    const hsl = rgbToHsl(red, green, blue);

    ctx.save();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0.289473 * imageWidth, 0.438596 * imageHeight);
    ctx.bezierCurveTo(
      0.289473 * imageWidth,
      0.561403 * imageHeight,
      0.385964 * imageWidth,
      0.605263 * imageHeight,
      0.385964 * imageWidth,
      0.745614 * imageHeight
    );
    ctx.bezierCurveTo(
      0.385964 * imageWidth,
      0.745614 * imageHeight,
      0.587719 * imageWidth,
      0.745614 * imageHeight,
      0.587719 * imageWidth,
      0.745614 * imageHeight
    );
    ctx.bezierCurveTo(
      0.587719 * imageWidth,
      0.605263 * imageHeight,
      0.692982 * imageWidth,
      0.561403 * imageHeight,
      0.692982 * imageWidth,
      0.438596 * imageHeight
    );
    ctx.bezierCurveTo(
      0.692982 * imageWidth,
      0.324561 * imageHeight,
      0.605263 * imageWidth,
      0.22807 * imageHeight,
      0.5 * imageWidth,
      0.22807 * imageHeight
    );
    ctx.bezierCurveTo(
      0.385964 * imageWidth,
      0.22807 * imageHeight,
      0.289473 * imageWidth,
      0.324561 * imageHeight,
      0.289473 * imageWidth,
      0.438596 * imageHeight
    );
    ctx.closePath();

    const glassOnFill = ctx.createLinearGradient(
      0,
      0.289473 * imageHeight,
      0,
      0.701754 * imageHeight
    );

    if (red === green && green === blue) {
      glassOnFill.addColorStop(0, 'hsl(0, 60%, 0%)');
      glassOnFill.addColorStop(1, 'hsl(0, 40%, 0%)');
    } else {
      glassOnFill.addColorStop(
        0,
        'hsl(' + hsl[0] * 255 + ', ' + hsl[1] * 100 + '%, 70%)'
      );
      glassOnFill.addColorStop(
        1,
        'hsl(' + hsl[0] * 255 + ', ' + hsl[1] * 100 + '%, 80%)'
      );
    }
    ctx.fillStyle = glassOnFill;

    // sets shadow properties
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowBlur = 30;
    ctx.shadowColor = glowColor;

    ctx.fill();

    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 0.008771 * imageWidth;
    ctx.strokeStyle = 'rgba(' + red + ', ' + green + ', ' + blue + ', 0.4)';
    ctx.stroke();

    ctx.restore();

    ctx.restore();
  };

  const drawBulb = function (ctx) {
    ctx.save();

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0.350877 * imageWidth, 0.333333 * imageHeight);
    ctx.bezierCurveTo(
      0.350877 * imageWidth,
      0.280701 * imageHeight,
      0.41228 * imageWidth,
      0.236842 * imageHeight,
      0.5 * imageWidth,
      0.236842 * imageHeight
    );
    ctx.bezierCurveTo(
      0.578947 * imageWidth,
      0.236842 * imageHeight,
      0.64035 * imageWidth,
      0.280701 * imageHeight,
      0.64035 * imageWidth,
      0.333333 * imageHeight
    );
    ctx.bezierCurveTo(
      0.64035 * imageWidth,
      0.385964 * imageHeight,
      0.578947 * imageWidth,
      0.429824 * imageHeight,
      0.5 * imageWidth,
      0.429824 * imageHeight
    );
    ctx.bezierCurveTo(
      0.41228 * imageWidth,
      0.429824 * imageHeight,
      0.350877 * imageWidth,
      0.385964 * imageHeight,
      0.350877 * imageWidth,
      0.333333 * imageHeight
    );
    ctx.closePath();
    const highlight = ctx.createLinearGradient(
      0,
      0.245614 * imageHeight,
      0,
      0.429824 * imageHeight
    );
    highlight.addColorStop(0, '#ffffff');
    highlight.addColorStop(0.99, 'rgba(255, 255, 255, 0)');
    highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = highlight;
    ctx.fill();
    ctx.restore();

    // winding
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0.377192 * imageWidth, 0.745614 * imageHeight);
    ctx.bezierCurveTo(
      0.377192 * imageWidth,
      0.745614 * imageHeight,
      0.429824 * imageWidth,
      0.72807 * imageHeight,
      0.491228 * imageWidth,
      0.72807 * imageHeight
    );
    ctx.bezierCurveTo(
      0.561403 * imageWidth,
      0.72807 * imageHeight,
      0.605263 * imageWidth,
      0.736842 * imageHeight,
      0.605263 * imageWidth,
      0.736842 * imageHeight
    );
    ctx.lineTo(0.605263 * imageWidth, 0.763157 * imageHeight);
    ctx.lineTo(0.596491 * imageWidth, 0.780701 * imageHeight);
    ctx.lineTo(0.605263 * imageWidth, 0.798245 * imageHeight);
    ctx.lineTo(0.596491 * imageWidth, 0.815789 * imageHeight);
    ctx.lineTo(0.605263 * imageWidth, 0.833333 * imageHeight);
    ctx.lineTo(0.596491 * imageWidth, 0.850877 * imageHeight);
    ctx.lineTo(0.605263 * imageWidth, 0.868421 * imageHeight);
    ctx.lineTo(0.596491 * imageWidth, 0.885964 * imageHeight);
    ctx.lineTo(0.605263 * imageWidth, 0.894736 * imageHeight);
    ctx.bezierCurveTo(
      0.605263 * imageWidth,
      0.894736 * imageHeight,
      0.570175 * imageWidth,
      0.95614 * imageHeight,
      0.535087 * imageWidth,
      0.991228 * imageHeight
    );
    ctx.bezierCurveTo(
      0.526315 * imageWidth,
      0.991228 * imageHeight,
      0.517543 * imageWidth,
      imageHeight,
      0.5 * imageWidth,
      imageHeight
    );
    ctx.bezierCurveTo(
      0.482456 * imageWidth,
      imageHeight,
      0.473684 * imageWidth,
      imageHeight,
      0.464912 * imageWidth,
      0.991228 * imageHeight
    );
    ctx.bezierCurveTo(
      0.421052 * imageWidth,
      0.947368 * imageHeight,
      0.394736 * imageWidth,
      0.903508 * imageHeight,
      0.394736 * imageWidth,
      0.903508 * imageHeight
    );
    ctx.lineTo(0.394736 * imageWidth, 0.894736 * imageHeight);
    ctx.lineTo(0.385964 * imageWidth, 0.885964 * imageHeight);
    ctx.lineTo(0.394736 * imageWidth, 0.868421 * imageHeight);
    ctx.lineTo(0.385964 * imageWidth, 0.850877 * imageHeight);
    ctx.lineTo(0.394736 * imageWidth, 0.833333 * imageHeight);
    ctx.lineTo(0.385964 * imageWidth, 0.815789 * imageHeight);
    ctx.lineTo(0.394736 * imageWidth, 0.798245 * imageHeight);
    ctx.lineTo(0.377192 * imageWidth, 0.789473 * imageHeight);
    ctx.lineTo(0.394736 * imageWidth, 0.771929 * imageHeight);
    ctx.lineTo(0.377192 * imageWidth, 0.763157 * imageHeight);
    ctx.lineTo(0.377192 * imageWidth, 0.745614 * imageHeight);
    ctx.closePath();
    const winding = ctx.createLinearGradient(
      0.473684 * imageWidth,
      0.72807 * imageHeight,
      0.484702 * imageWidth,
      0.938307 * imageHeight
    );
    winding.addColorStop(0, '#333333');
    winding.addColorStop(0.04, '#d9dad6');
    winding.addColorStop(0.19, '#e4e5e0');
    winding.addColorStop(0.24, '#979996');
    winding.addColorStop(0.31, '#fbffff');
    winding.addColorStop(0.4, '#818584');
    winding.addColorStop(0.48, '#f5f7f4');
    winding.addColorStop(0.56, '#959794');
    winding.addColorStop(0.64, '#f2f2f0');
    winding.addColorStop(0.7, '#828783');
    winding.addColorStop(0.78, '#fcfcfc');
    winding.addColorStop(1, '#666666');
    ctx.fillStyle = winding;
    ctx.fill();
    ctx.restore();

    // winding
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0.377192 * imageWidth, 0.745614 * imageHeight);
    ctx.bezierCurveTo(
      0.377192 * imageWidth,
      0.745614 * imageHeight,
      0.429824 * imageWidth,
      0.72807 * imageHeight,
      0.491228 * imageWidth,
      0.72807 * imageHeight
    );
    ctx.bezierCurveTo(
      0.561403 * imageWidth,
      0.72807 * imageHeight,
      0.605263 * imageWidth,
      0.736842 * imageHeight,
      0.605263 * imageWidth,
      0.736842 * imageHeight
    );
    ctx.lineTo(0.605263 * imageWidth, 0.763157 * imageHeight);
    ctx.lineTo(0.596491 * imageWidth, 0.780701 * imageHeight);
    ctx.lineTo(0.605263 * imageWidth, 0.798245 * imageHeight);
    ctx.lineTo(0.596491 * imageWidth, 0.815789 * imageHeight);
    ctx.lineTo(0.605263 * imageWidth, 0.833333 * imageHeight);
    ctx.lineTo(0.596491 * imageWidth, 0.850877 * imageHeight);
    ctx.lineTo(0.605263 * imageWidth, 0.868421 * imageHeight);
    ctx.lineTo(0.596491 * imageWidth, 0.885964 * imageHeight);
    ctx.lineTo(0.605263 * imageWidth, 0.894736 * imageHeight);
    ctx.bezierCurveTo(
      0.605263 * imageWidth,
      0.894736 * imageHeight,
      0.570175 * imageWidth,
      0.95614 * imageHeight,
      0.535087 * imageWidth,
      0.991228 * imageHeight
    );
    ctx.bezierCurveTo(
      0.526315 * imageWidth,
      0.991228 * imageHeight,
      0.517543 * imageWidth,
      imageHeight,
      0.5 * imageWidth,
      imageHeight
    );
    ctx.bezierCurveTo(
      0.482456 * imageWidth,
      imageHeight,
      0.473684 * imageWidth,
      imageHeight,
      0.464912 * imageWidth,
      0.991228 * imageHeight
    );
    ctx.bezierCurveTo(
      0.421052 * imageWidth,
      0.947368 * imageHeight,
      0.394736 * imageWidth,
      0.903508 * imageHeight,
      0.394736 * imageWidth,
      0.903508 * imageHeight
    );
    ctx.lineTo(0.394736 * imageWidth, 0.894736 * imageHeight);
    ctx.lineTo(0.385964 * imageWidth, 0.885964 * imageHeight);
    ctx.lineTo(0.394736 * imageWidth, 0.868421 * imageHeight);
    ctx.lineTo(0.385964 * imageWidth, 0.850877 * imageHeight);
    ctx.lineTo(0.394736 * imageWidth, 0.833333 * imageHeight);
    ctx.lineTo(0.385964 * imageWidth, 0.815789 * imageHeight);
    ctx.lineTo(0.394736 * imageWidth, 0.798245 * imageHeight);
    ctx.lineTo(0.377192 * imageWidth, 0.789473 * imageHeight);
    ctx.lineTo(0.394736 * imageWidth, 0.771929 * imageHeight);
    ctx.lineTo(0.377192 * imageWidth, 0.763157 * imageHeight);
    ctx.lineTo(0.377192 * imageWidth, 0.745614 * imageHeight);
    ctx.closePath();
    const winding1 = ctx.createLinearGradient(
      0.377192 * imageWidth,
      0.789473 * imageHeight,
      0.605263 * imageWidth,
      0.789473 * imageHeight
    );
    winding1.addColorStop(0, 'rgba(0, 0, 0, 0.4)');
    winding1.addColorStop(0.15, 'rgba(0, 0, 0, 0.32)');
    winding1.addColorStop(0.85, 'rgba(0, 0, 0, 0.33)');
    winding1.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
    ctx.fillStyle = winding1;
    ctx.fill();
    ctx.restore();

    // contact plate
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0.421052 * imageWidth, 0.947368 * imageHeight);
    ctx.bezierCurveTo(
      0.438596 * imageWidth,
      0.95614 * imageHeight,
      0.447368 * imageWidth,
      0.973684 * imageHeight,
      0.464912 * imageWidth,
      0.991228 * imageHeight
    );
    ctx.bezierCurveTo(
      0.473684 * imageWidth,
      imageHeight,
      0.482456 * imageWidth,
      imageHeight,
      0.5 * imageWidth,
      imageHeight
    );
    ctx.bezierCurveTo(
      0.517543 * imageWidth,
      imageHeight,
      0.526315 * imageWidth,
      0.991228 * imageHeight,
      0.535087 * imageWidth,
      0.991228 * imageHeight
    );
    ctx.bezierCurveTo(
      0.543859 * imageWidth,
      0.982456 * imageHeight,
      0.561403 * imageWidth,
      0.95614 * imageHeight,
      0.578947 * imageWidth,
      0.947368 * imageHeight
    );
    ctx.bezierCurveTo(
      0.552631 * imageWidth,
      0.938596 * imageHeight,
      0.526315 * imageWidth,
      0.938596 * imageHeight,
      0.5 * imageWidth,
      0.938596 * imageHeight
    );
    ctx.bezierCurveTo(
      0.473684 * imageWidth,
      0.938596 * imageHeight,
      0.447368 * imageWidth,
      0.938596 * imageHeight,
      0.421052 * imageWidth,
      0.947368 * imageHeight
    );
    ctx.closePath();
    const contactPlate = ctx.createLinearGradient(
      0,
      0.938596 * imageHeight,
      0,
      imageHeight
    );
    contactPlate.addColorStop(0, '#050a06');
    contactPlate.addColorStop(0.61, '#070602');
    contactPlate.addColorStop(0.71, '#999288');
    contactPlate.addColorStop(0.83, '#010101');
    contactPlate.addColorStop(1, '#000000');
    ctx.fillStyle = contactPlate;
    ctx.fill();
    ctx.restore();
    ctx.restore();
  };

  const clearCanvas = function (ctx) {
    // Store the current transformation matrix
    ctx.save();

    // Use the identity matrix while clearing the canvas
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Restore the transform
    ctx.restore();
  };

  const init = function () {
    initialized = true;
    drawOff(offCtx);
    drawOn(onCtx);
    drawBulb(bulbCtx);
  };

  // Component visualization
  const repaint = function () {
    if (!initialized) {
      init();
    }

    clearCanvas(mainCtx);

    mainCtx.save();

    mainCtx.drawImage(offBuffer, 0, 0);

    mainCtx.globalAlpha = alpha;
    if (lightOn) {
      mainCtx.drawImage(onBuffer, 0, 0);
    }
    mainCtx.globalAlpha = 1;
    mainCtx.drawImage(bulbBuffer, 0, 0);
    mainCtx.restore();
  };

  repaint();
}

class LightbulbElement extends BaseElement {
  static get drawFunction () { return drawLightbulb }

  static get properties () {
    return {
      width: { type: Number, defaultValue: 100 },
      height: { type: Number, defaultValue: 150 },
      lightOn: { type: Boolean, defaultValue: false },
      glowColor: { type: String, defaultValue: '#ffff00' }
    }
  }

  render () {
    return $`
      <canvas width="${this.width}" height="${this.height}"></canvas>
    `
  }
}

window.customElements.define('steelseries-lightbulb', LightbulbElement);

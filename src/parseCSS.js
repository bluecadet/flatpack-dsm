//
// Set PX size value
//
const setSizeValue = (pxValue, fpackOpts) => {
  // Determine Strategy
  var opts = fpackOpts.opts.replacePx;

  if (!opts.enable) {
    return pxValue;
  }

  var num = pxValue.match(/\d+/);
  var newNum;

  if (opts.val === 'rem' && opts.remUseTenth) {
    newNum = (parseInt(num[0]) * 0.1);
    newNum = (+newNum).toFixed(4);

    if (newNum.match(/\./)) {
      newNum = newNum.replace(/\.?0+$/, '');
    }

  } else {
    newNum = (parseInt(num[0]) / opts.emBase);
  }

  var newVal = pxValue.replace('px', opts.val);
      newVal = newVal.replace(/\d+/g, newNum);

  return newVal;
}


//
// Parse CSS
//
module.exports = function(style, fpackOpts, fpackColorData) {

  var cssAttrs = '';
  var hexColor = /^#[0-9A-F]{6}$/i;


  // Remove name attr
  if (style['name']) {
    delete style['name'];
  }

  // Convert text-color to color
  if (style['text-color']) {
    style['color'] = style['text-color'];
    delete(style['text-color']);
  }

  // Loop through propos and attributes
  Object.keys(style).forEach(function(propName) {
    var prop = propName;
    var attribute = style[prop];

    if (
      attribute === null ||
      prop === 'textAlign' ||
      ( prop === 'fontStyle' && attribute === 'normal') ||
      ( prop === 'fontWeight' && attribute === fpackOpts.opts.defaultFontWeight )
    ) {
      return;
    }

    // Convert js camelCase to css prop name
    for (i = 0; i < prop.length; i++) {
      if (prop.charAt(i) === prop.charAt(i).toUpperCase()) {
        prop = prop.replace(prop.charAt(i), `-${prop.charAt(i).toLowerCase()}`)
      }
    }

    if (attribute.includes('px')) {

      if (prop === 'line-height') {
        var val = parseInt(style['fontSize']) / parseInt(attribute);
        attribute = Math.round(val * 100) / 100;
      } else {
        attribute = setSizeValue(attribute, fpackOpts);
      }
    }

    if (hexColor.test(attribute)) {
      if (fpackColorData.hasOwnProperty(attribute)) {
        attribute = fpackColorData[attribute];
      }
    }

    if (prop === 'font-family') {
      attribute = `'${attribute}'`;
    }

    cssAttrs += `${prop}: ${attribute};\n`;

  });

  return cssAttrs;
}
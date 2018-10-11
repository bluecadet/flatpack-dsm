const replacePxValue = (pxValue, replaceUnit, multiplier) => {

  var num = pxValue.match(/\d+/);
  var newNum = (parseInt(num[0]) * multiplier);

  // Remove unneccessary decimals that may occur
  newNum = (+newNum).toFixed(4);
  if (newNum.match(/\./)) {
    newNum = newNum.replace(/\.?0+$/, '');
  }

  var newVal = pxValue.replace('px', replaceUnit);
      newVal = newVal.replace(/\d+/g, newNum);

  return newVal;
}

module.exports = {
  replacePxValue
}
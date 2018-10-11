const _ = require('lodash');
const colors = require('colors/safe');
const https = require('https');
const path = require('path');
const fs = require('fs');
const request = require('request');
const mkdirp = require('mkdirp');
const unzip = require('unzip');
const globmove = require('glob-move');
const rimraf = require('rimraf');

const localPath = process.cwd();
const fpackUtils = require('./src/utils.js');

//
// Default options
//
const fpackDefaultOpts = {
  dest: {
    colorVars: {
      name: 'vars.colors',
      path: '/scss',
    },
    typeVars: {
      name: 'vars.type',
      path: '/scss',
    },
    icons: '/icons',
    json: false
  },
  opts: {
    colorPrefix: 'color-',
    typePrefix: 'type-',
    replacePx: {
      enable: false,          // boolean
      val: 'rem',             // `rem` or `em`
      remUseTenth: false,     // boolean - use rem tenth calculation (if 12px = 1.2rem)
      emBase: '16'            // em calculation base
    },
    defaultFontWeight: '400'
  }
}

// Merged Options
let fpackOpts = {};

// DSM JSON
let fpackJSON = {};
let fpackColorData = {};






const setSizeValue = (pxValue) => {
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
// Parse colors, add to file
//
const fpackParseColors = () => {

  if (
    !fpackJSON.hasOwnProperty('colors') ||
    typeof fpackJSON.colors !== 'object' ||
    Object.keys(fpackJSON.colors).length === 0
    //  ||
    // !fpackJSON.hasOwnProperty('list') ||
    // !fpackJSON.list.hasOwnProperty('colors') ||
    // typeof fpackJSON.list.colors !== 'object' ||
    // Object.keys(fpackJSON.list.colors).length === 0
  ) {
    console.log(colors.red('No DSM color data.'));
    return;
  }

  // Support basic JSON and JSON with `?exportFormat=list`
  let fpackColors = false;

  if ( fpackJSON.hasOwnProperty('list') ) {
    fpackColors = fpackJSON.list.colors;
  } else {
    fpackColors = fpackJSON.colors;
  }

  // Get sass file
  const fileOpts = fpackOpts.dest.colorVars;
  const filePathBase = path.normalize(`${localPath}/${fileOpts.path}`);

  // Check for scss extension, add if not present
  let fileName = fileOpts.name,
      ext = fileOpts.name.split('.').pop();

  if (ext !== 'scss') {
    fileName = fileName + '.scss';
  }

  // Build filepath
  const filePath = path.normalize(`${filePathBase}/${fileName}`);

  // Iterate through colors, build sassVar string with wrapping
  // comments for regex
  let newData = '/// START DSM VARIABLES\n';

  Object.keys(fpackColors).forEach(function(colorName) {
    const sassName = fpackOpts.opts.colorPrefix + colorName;
    const sassVal = fpackColors[colorName];
    const sassVar = `$${sassName}: ${sassVal};`;
    newData += sassVar + '\n';

    // Add to color tracker
    fpackColorData[sassVal] = `$${sassName}`;

  });

  newData += '/// END DSM VARIABLES';

  // Grab the sass file
  fs.readFile(filePath, 'utf8', function(err, data){

    // On error, create file if possible, add newData
    if (err) {

      mkdirp(filePathBase);

      fs.writeFile(filePath, newData, (err) => {
        if(err) {
          var error = new Error("Error reading sass file");
          console.log(colors.red(error.message));
          return;
        }
        console.log(colors.green(`Created ${fileOpts.path}/${fileName}`));
      });

    } else {

      // Create regex to replace data
      var oldData = new RegExp(/\/\/\/ START DSM VARIABLES[\s\S]*END DSM VARIABLES/gim);
      var testReplace = oldData.test(data);

      if ( testReplace ) {
        var replaceData = data.replace(oldData, newData);

        // Write the new data to the file
        fs.writeFile(filePath, replaceData, 'utf8', (err) => {
          if(err) {
            var error = new Error("Error writing sass file");
            console.log(colors.red(error.message));
            return;
          }
          console.log(colors.green(`\u2713 DSM Color variables updated in`), colors.cyan(`${fileOpts.path}/${fileName}`));
        });

      } else {

        // Regex has failed
        var error = new Error("Can not find variable matches.");
        console.log(
          colors.red("Can not find variable matches. Please wrap DSM wariables as:\n"),
          colors.cyan("/// START DSM VARIABLES\n"),
          colors.cyan("$var: val;\n"),
          colors.cyan("$etc: etc;\n"),
          colors.cyan("/// END DSM VARIABLES\n")
        );
        return;
      }

    }
  });

}


//
// Parse type styles, add files
//
const fpackParseFontStyles = () => {

  if (
    !fpackJSON.hasOwnProperty('fontStyles') ||
    typeof fpackJSON.fontStyles !== 'object' ||
    Object.keys(fpackJSON.fontStyles).length === 0
    //  ||
    // !fpackJSON.hasOwnProperty('list') ||
    // !fpackJSON.list.hasOwnProperty('fontStyles') ||
    // typeof fpackJSON.list.fontStyles !== 'object' ||
    // Object.keys(fpackJSON.list.fontStyles).length === 0
  ) {
    console.log(colors.red('No DSM type style data.'));
    return;
  }

  // Support basic JSON and JSON with `?exportFormat=list`
  let fpackType = false;

  if ( fpackJSON.hasOwnProperty('list') ) {
    fpackType = fpackJSON.list.fontStyles;
  } else {
    fpackType = fpackJSON.fontStyles;
  }

  // Get sass file
  const fileOpts = fpackOpts.dest.typeVars;
  const filePathBase = path.normalize(`${localPath}/${fileOpts.path}`);

  // Check for scss extension, add if not present
  let fileName = fileOpts.name,
      ext = fileOpts.name.split('.').pop();

  if (ext !== 'scss') {
    fileName = fileName + '.scss';
  }

  // Build filepath
  const filePath = path.normalize(`${filePathBase}/${fileName}`);

  // Iterate through colors, build sassVar string with wrapping
  // comments for regex
  let newData = '/// START DSM VARIABLES\n';

  Object.keys(fpackType).forEach(function(typeName) {
    // const sassName = fpackOpts.opts.colorPrefix + colorName;
    // const sassVal = fpackType[colorName];
    // const sassVar = `$${sassName}: ${sassVal};`;
    // newData += sassVar + '\n';

    const mixinName = fpackOpts.opts.typePrefix + typeName;
    const t = fpackType[typeName];

    let mixin = `@mixin ${mixinName} {\n`;

    if (t['font-size']) {
      var val = setSizeValue(t['font-size']);
      // if (fpackOpts.opts.pxReplace) {
      //   val = setSizeValue(t['font-size']);
      // } else {
      //   val = t['font-size'];
      // }
      mixin += `  font-size: ${val};\n`;

      delete t['font-size'];
    }

    if (t['text-color']) {
      var tc = t['text-color'];
      var val;

      if (fpackColorData.hasOwnProperty(tc)) {
        val = fpackColorData[tc];
      } else {
        val = t['font-size'];
      }
      mixin += `  color: ${val};\n`;

      delete t['text-color'];
    }

    if (t['font-family']) {
      mixin += `  font-family: '${t['font-family']}';\n`;
      delete t['font-family'];
    }

    if (t['font-style']) {
      if (t['font-style'] !== 'normal') {
        mixin += `  font-style: ${t['font-style']};\n`;
      }
      delete t['font-style'];
    }

    if (t['font-weight']) {
      if (t['font-weight'] !== fpackOpts.opts.defaultFontWeight) {
        mixin += `  font-weight: ${t['font-weight']};\n`;
      }
      delete t['font-weight'];
    }

    Object.keys(t).forEach(function(prop) {
      mixin += `  ${prop}: ${t[prop]};\n`;
    });

    mixin += '}\n\n';

    newData += mixin;

  });

  newData += '/// END DSM VARIABLES';

  // Grab the sass file
  fs.readFile(filePath, 'utf8', function(err, data){

    // On error, create file if possible, add newData
    if (err) {

      mkdirp(filePathBase);

      fs.writeFile(filePath, newData, (err) => {
        if(err) {
          var error = new Error("Error reading sass file");
          console.log(colors.red(error.message));
          return;
        }
        console.log(colors.green(`Created ${fileOpts.path}/${fileName}`));
      });

    } else {

      // Create regex to replace data
      var oldData = new RegExp(/\/\/\/ START DSM VARIABLES[\s\S]*END DSM VARIABLES/gim);
      var testReplace = oldData.test(data);

      if ( testReplace ) {
        var replaceData = data.replace(oldData, newData);

        // Write the new data to the file
        fs.writeFile(filePath, replaceData, 'utf8', (err) => {
          if(err) {
            var error = new Error("Error writing sass file");
            console.log(colors.red(error.message));
            return;
          }
          console.log(colors.green(`\u2713 DSM Font Style variables updated in`), colors.cyan(`${fileOpts.path}/${fileName}`));
        });

      } else {

        // Regex has failed
        var error = new Error("Can not find variable matches.");
        console.log(
          colors.red("Can not find variable matches. Please wrap DSM wariables as:\n"),
          colors.cyan("/// START DSM VARIABLES\n"),
          colors.cyan("$var: val;\n"),
          colors.cyan("$etc: etc;\n"),
          colors.cyan("/// END DSM VARIABLES\n")
        );
        return;
      }

    }
  });



}





//
// GET DSM JSON DATA
//
//
const fpackGetDSMJSON = () => {
  https.get(fpackOpts.urls.json, (response) => {
    const { statusCode } = response;
    const contentType = response.headers['content-type'];

    let error;
    if (statusCode !== 200) {
      error = new Error('Request Failed.\n' +
                        `Status Code: ${statusCode}`);
    }
    // else if (!/^application\/json/.test(contentType)) {
    //   error = new Error('Invalid content-type.\n' +
    //                     `Expected application/json but received ${contentType}`);
    // }
    if (error) {
      console.error(error.message);
      // consume response data to free up memory
      response.resume();
      return;
    }

    response.setEncoding('utf8');
    let rawData = '';

    response.on('data', (chunk) => { rawData += chunk; });

    response.on('end', () => {
      try {

        fpackJSON = JSON.parse(rawData);
        fpackParseColors();
        fpackParseFontStyles();

      } catch (e) {
        console.error(e.message);
      }
    });

  }).on('error', (e) => {
    console.error(`Got error: ${e.message}`);
  });
}


//
// GET DSM JSON DATA
//
//
const fpackGetDSMIcons = () => {
  const iconsFile = 'icons.zip';
  const tmpPath = `${localPath}/DSMICONSTMP`;
  const iconsZipPath = `${tmpPath}/${iconsFile}`;
  const fileOpts = fpackOpts.dest.icons;
  const filePath = path.normalize(`${localPath}/${fileOpts}`);

  request({url: fpackOpts.urls.icons, encoding: null}, function(err, resp, body) {
    if(err) throw err;

    mkdirp(tmpPath);
    mkdirp(filePath);

    // Write the zip file
    fs.writeFile(iconsZipPath, body, function(err) {
      if (err) {
        console.log(err);
      }

      // Read file and unzip
      var stream = fs.createReadStream(iconsZipPath)
        .pipe(unzip.Extract({ path: tmpPath }));

      // After read is complete, move svg files
      stream.on('finish', () => {
        globmove(`${tmpPath}/**/*.svg`, filePath)
          .then(() => {
            rimraf(tmpPath, function(err){
              console.log(colors.green(`\u2713 DSM Icons added to`), colors.cyan(`${fpackOpts.dest.icons}`));
            });
          });
      });

    });
  });
}


//
// Get DSM Data
//
const fpackDSM = () => {

  if (!fpackOpts.urls.json) {
    var error = new Error('DSM JSON Path required');
    console.log(colors.red(error.message));
    return;
  }

  if (!fpackOpts.urls.icons) {
    var error = new Error('DSM ICON Path required');
    console.log(colors.red(error.message));
    return;
  }

  // GET DMS JSON
  fpackGetDSMJSON();

  // GET DMS Icons
  fpackGetDSMIcons();

}




//
// Kickoff Flatpacking
//
const initFlatPack = userOptions => {

  // Merge Options
  fpackOpts = _.merge({}, fpackDefaultOpts, userOptions);

  fpackDSM();

}




//
// Handle Errors
//
var handleError = function (e) {

  // default to exiting process on error
  var exit = true;

  // construct error object by combining argument with defaults
  var error = _.assign({}, {
    name: 'Error',
    reason: '',
    message: 'An error occurred',
  }, e);

  console.error('FLATPACK ERROR: ' + e.message + '\n', e.stack);

}


//
// Module export
//
module.exports = function (options) {

  try {

    // Merge Options
    initFlatPack(options);

    // Build out files
    // buildEcho();

  } catch (e) {
    handleError(e);
  }

};
const _            = require('lodash');
const colors       = require('colors/safe');
const https        = require('https');
const path         = require('path');
const fs           = require('fs');
const request      = require('request');
const mkdirp       = require('mkdirp');
const unzip        = require('unzip');
const decompress = require('decompress');
const globmove     = require('glob-move');
const rimraf       = require('rimraf');
const indentString = require('indent-string');
const localPath    = process.cwd();
const parseCSS     = require('./src/parseCSS.js');

//
// Default options
//
const fpackDefaultOpts = {
  dest: {
    colors: '/scss/vars.colors.scss',
    type: '/scss/vars.type.scss',
    icons: '/icons',
    json: false
  },
  fractal: {
    enable: false,          // boolean
    colors: {
      file: '/components/colors/colors.config.json',
      context: 'context.colors'
    }
  },
  opts: {
    colorPrefix: 'color-',
    typePrefix: 'type-',
    indent: 2,
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



//
// Write a sass file, replace existing vars in file
//
function fpackWriteSassFile(fileBasePath, newData) {

  const filePath = path.normalize(fileBasePath);

  // Grab the sass file
  fs.readFile(filePath, 'utf8', function(err, data){

    if (err) {

      mkdirp(path.dirname(fileBasePath));

      fs.writeFile(filePath, newData, (err) => {

        if (err) {
          var error = new Error(`Error writing new sass file @ ${filePath}`);
          handleError(error);
          return;
        }

        console.log(
          colors.green(`\u2713 Created`),
          colors.cyan(`${filePath.replace(localPath, '')}`)
        );

      });

    } else {

      // Create regex to replace data
      const oldData = new RegExp(/\/\/\/ START DSM VARIABLES[\s\S]*END DSM VARIABLES/gim);
      const testReplace = oldData.test(data);

      if ( testReplace ) {
        var replaceData = data.replace(oldData, newData);

        // Write the new data to the file
        fs.writeFile(filePath, replaceData, 'utf8', (err) => {
          if ( err ) {
            var error = new Error('Error writing updated sass file');
            handleError(error);
            return;
          }

          console.log(
            colors.green(`\u2713 DSM Font Style variables updated in`),
            colors.cyan(`${filePath.replace(localPath, '')}`)
          );
        });

      } else {

        // Regex has failed
        var error = new Error("Can not find variable matches.");
        console.log(
          colors.red("Can not find variable matches. Please add or wrap DSM variables as:\n"),
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
// Parse colors, add to file
//
const fpackParseColors = () => {

  let fpackColors = false;

  // Support basic JSON sent with `?exportFormat=list` in url
  if ( fpackJSON.hasOwnProperty('list') ) {

    if ( fpackJSON.list.hasOwnProperty('colors') ) {
      var c = fpackJSON.list.colors;

      if (Array.isArray(c)) {
        fpackColors = {};

        c.forEach(group => {
          var groupColors = group.colors;

          groupColors.forEach(colorPair => {
            fpackColors[colorPair.name] = colorPair.value;
          });

        });
      }
    }

  }
  // Support basic JSON url
  else {

    if ( fpackJSON.hasOwnProperty('colors') && Object.keys(fpackJSON.colors).length > 0 ) {
      fpackColors = fpackJSON.colors;
    }

  }


  // Bail if nothing
  if (!fpackColors) {
    console.log(colors.red('No DSM color data.'));
    return;
  }

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

  fpackWriteSassFile(
    path.normalize(`${localPath}/${fpackOpts.dest.colors}`),
    newData
  );

}



const fpackParseTypeStyles = () => {

  var typeStyles = fpackJSON.list.typeStyles;

  let newData = '/// START DSM VARIABLES\n';

  typeStyles.forEach((typeStyle) => {
    // Properly format DSM typestyle name
    let tsName = typeStyle['name'].replace(/\//g, '-');
        tsName = tsName.replace(/ /g, '');

    // Format name with prefixe
    const mixinName = fpackOpts.opts.typePrefix + tsName;

    // Build mixin content
    let mixin = `@mixin ${mixinName.toLowerCase()} {\n` +
                 indentString(parseCSS(typeStyle, fpackOpts, fpackColorData), fpackOpts.opts.indent) +
                 '}\n\n';

    newData += mixin;

  });

  newData += '/// END DSM VARIABLES';

  fpackWriteSassFile(
    path.normalize(`${localPath}/${fpackOpts.dest.type}`),
    newData
  );

}


//
// Parse type styles, add files
//
const fpackParseFontStyles = () => {

  const fpackType = fpackJSON.fontStyles;

  // Iterate through colors, build sassVar string with wrapping
  // comments for regex
  let newData = '/// START DSM VARIABLES\n';

  Object.keys(fpackType).forEach(function(typeName) {

    let mixin = `@mixin ${fpackOpts.opts.typePrefix + typeName} {\n` +
                 indentString(parseCSS(fpackType[typeName], fpackOpts, fpackColorData), fpackOpts.opts.indent) +
                 '}\n\n';

    newData += mixin;

  });

  newData += '/// END DSM VARIABLES';

  fpackWriteSassFile(
    path.normalize(`${localPath}/${fpackOpts.dest.type}`),
    newData
  );

}


//
// Parse Color JSON and write to Fractal context
//
const fpackParseFractalColors = () => {

  const filePath = path.normalize(`${localPath}/${fpackOpts.fractal.colors.file}`);
  let fractalConfig = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  fractalConfig.context[fpackOpts.fractal.colors.context] = fpackColorData;
  fractalConfig = JSON.stringify(fractalConfig, null, 2);

  fs.writeFile(filePath, fractalConfig, function(err){
    if (err) {
      var error = new Error('Cannot write Fractal file');
      handleError(error);
      return;
    }

    console.log(colors.green(`\u2713 DSM data updated in Fractal \`context.${fpackOpts.fractal.colors.context}\``), colors.cyan(`${fpackOpts.fractal.colors.file}`));
  });

}





//
// GET DSM JSON DATA
//
//
const fpackGetDSMJSON = () => {

  request({url: fpackOpts.urls.json, encoding: 'utf8'}, function(err, resp, body) {

    if (err) {
      var error = new Error('');
      handleError(error);
      return;
    }

    fpackJSON = JSON.parse(body);

    fpackParseColors();

    if (fpackOpts.fractal.enable) {
      fpackParseFractalColors();
    }

    if ( fpackJSON.hasOwnProperty('list') ) {
      fpackParseTypeStyles();
    } else if ( fpackJSON.hasOwnProperty('fontStyles') && Object.keys(fpackJSON.fontStyles).length > 0 ) {
      fpackParseFontStyles();
    } else {
      console.log(colors.red('No DSM font or type style data.'));
    }

  });
}


//
// GET DSM JSON DATA
//
//
const fpackGetDSMIcons = () => {

  const tmpPath = `${localPath}/DSMICONSTMP`;
  const fileOpts = fpackOpts.dest.icons;
  const filePath = path.normalize(`${localPath}/${fileOpts}`);

  request({url: fpackOpts.urls.icons, encoding: null}, function(err, resp, body) {

    if (err) {
      var error = new Error('');
      handleError(error);
      return;
    }

    mkdirp(tmpPath);
    mkdirp(filePath);

    decompress(body, tmpPath)
      .then(() => {
        globmove(`${tmpPath}/**/*.svg`, filePath)
          .then(() => {
            rimraf(tmpPath, function(err){
              console.log(colors.green(`\u2713 DSM Icons added to`), colors.cyan(`${fpackOpts.dest.icons}`));
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
    handleError(error);
    return;
  }

  if (!fpackOpts.urls.icons) {
    var error = new Error('DSM ICON Path required');
    handleError(error);
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

  console.log(colors.red('FLATPACK ERROR: ' + e.message + '\n'), e.stack);

}


//
// Module export
//
module.exports = function (options) {

  try {
    // Merge Options
    initFlatPack(options);

  } catch (e) {
    handleError(e);
  }

};
const _            = require('lodash');
const colors       = require('colors/safe');
const https        = require('https');
const path         = require('path');
const fs           = require('fs');
const request      = require('request');
const mkdirp       = require('mkdirp');
const unzip        = require('unzip');
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
function fpackWriteSassFile(name, fileBasePath, newData) {

  // Check for scss extension, add if not present
  let fileName = name;
  let ext = fileName.split('.').pop();

  if (ext !== 'scss') {
    fileName = `${fileName}.scss`;
  }

  let filePath = path.normalize(`${fileBasePath}/${fileName}`);

  // Grab the sass file
  fs.readFile(filePath, 'utf8', function(err, data){

    // On error, create file if possible, add newData
    if (err) {

      mkdirp(fileBasePath);

      fs.writeFile(filePath, newData, (err) => {
        if(err) {
          var error = new Error("Error reading sass file");
          console.log(colors.red(error.message));
          return;
        }
        console.log(colors.green(`Created ${filePath}`));
      });

    } else {

      // Create regex to replace data
      var oldData = new RegExp(/\/\/\/ START DSM VARIABLES[\s\S]*END DSM VARIABLES/gim);
      var testReplace = oldData.test(data);

      if ( testReplace ) {
        var replaceData = data.replace(oldData, newData);

        // Write the new data to the file
        fs.writeFile(filePath, replaceData, 'utf8', (err) => {
          if ( err ) {
            var error = new Error("Error writing sass file");
            console.log(colors.red(error.message));
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



const fpackParseTypeStyles = () => {

  var typeStyles = fpackJSON.list.typeStyles;
  fpackType = [];

  // if (Array.isArray(typeStyles)) {

    let newData = '/// START DSM VARIABLES\n';

    typeStyles.forEach((typeStyle) => {
      let tsName = typeStyle['name'].replace(/\//g, '-');
          tsName = tsName.replace(/ /g, '');
      const mixinName = fpackOpts.opts.typePrefix + tsName;

      let mixin = `@mixin ${mixinName.toLowerCase()} {\n`;
      mixin += indentString(parseCSS(typeStyle, fpackOpts, fpackColorData), fpackOpts.opts.indent);
      mixin += '}\n\n';

      newData += mixin;

    });

    newData += '/// END DSM VARIABLES';

  // }

  fpackWriteSassFile(
    fpackOpts.dest.typeVars.name,
    path.normalize(`${localPath}/${fpackOpts.dest.typeVars.path}`),
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

    const mixinName = fpackOpts.opts.typePrefix + typeName;
    const t = fpackType[typeName];

    let mixin = `@mixin ${mixinName} {\n`;
    mixin += indentString(parseCSS(t, fpackOpts, fpackColorData), fpackOpts.opts.indent);
    mixin += '}\n\n';

    newData += mixin;

  });

  newData += '/// END DSM VARIABLES';

  fpackWriteSassFile(
    fpackOpts.dest.typeVars.name,
    path.normalize(`${localPath}/${fpackOpts.dest.typeVars.path}`),
    newData
  );

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

        if ( fpackJSON.hasOwnProperty('list') ) {
          fpackParseTypeStyles();
        } else if ( fpackJSON.hasOwnProperty('fontStyles') && Object.keys(fpackJSON.fontStyles).length > 0 ) {
          fpackParseFontStyles();
        } else {
          console.log(colors.red('No DSM font or type style data.'));
          return;
        }

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

  } catch (e) {
    handleError(e);
  }

};
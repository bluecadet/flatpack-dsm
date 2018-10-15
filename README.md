<h1 align="center">Flatpack DSM</h1>

Connect to Invision DSM, grab color and type vars, icons via gulp.

*Note: At this time, the DSM project must be set to public.*

## Usage

`npm install --save-dev flatpack-dsm`

In gulp, set the DSM urls (example using Gulp 4):

```
const gulp = require('gulp');
const flatpackDSM = require('../flatpack-dsm');

gulp.task('default', done => {

  flatpackDSM({
    urls: {
      json: 'https://bluecadet.invisionapp.com/dsm-export/bluecadet/greene-space/style-data.json?exportFormat=list',
      icons: 'https://bluecadet.invisionapp.com/dsm-export/bluecadet/greene-space/icons.zip',
    }
    // OTHER OPTIONS
  });

  done();
});
```


## Options (with default values)
```
{
  dest: {
    colors: '/scss/vars.colors.scss',                 // Path for color vars file
    type: '/scss/vars.type.scss',                     // Path for type vars file
    icons: '/icons'                                   // Path icons should be placed
  },
  fractal: {
    enable: false,                                    // boolean
    colors: {
      file: '/components/colors/colors.config.json',  // Path to a fractal config.json file
      context: 'context.colors'                       // Fractal context path (single depth)
    }
  },
  colorPrefix: 'color-',   // Prefix for sass color variables
  typePrefix: 'type-',     // Prefix for sass type variables
  indent: 2,               // Integer - indent value for css
  replacePx: {
    enable: false,         // Boolean - if px values should be replaced
    val: 'rem',            // Replacement value - `rem` or `em`
    remUseTenth: false,    // Boolean - use rem tenth calculation (if 12px = 1.2rem)
    emBase: '16'           // em calculation base
  },
  defaultFontWeight: '400' // Default font weight (deletes `font-weight` attributes with matching value)
}
```
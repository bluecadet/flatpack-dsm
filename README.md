<h1 align="center">Flatpack DSM</h1>

Connect to Invision DSM, grab color and type vars, icons via gulp.

## Usage

In gulp:

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
    colorVars: {
      name: 'vars.colors',  // Name for color vars file
      path: '/scss',         // Path for color vars file
    },
    typeVars: {
      name: 'vars.type',     // Name for type vars file
      path: '/scss',         // Path for type vars file
    },
    icons: '/icons'          // Path icons should be placed
  },
  opts: {
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
}
```
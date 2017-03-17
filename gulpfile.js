var gulp   = require( 'gulp' ),
    server = require( 'gulp-develop-server' )
    jshint = require('gulp-jshint');

gulp.task('lint', function() {
  return gulp.src('app.js')
    .pipe(jshint())
    .pipe(jshint.reporter('default'));
});

gulp.task( 'server:start', function() {
    server.listen( { path: './app.js' } );
});

gulp.task( 'server:restart', function() {
    gulp.watch( [ './app.js' ], server.restart );
});

gulp.task('default', ['lint','server:start','server:restart']);
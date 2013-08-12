WDL Viewer
==========

This is the open-source release of the World Digital Library's book viewer: e.g. http://www.wdl.org/en/item/211/view/

Prerequisites & Notes
---------------------

* Compass::

    gem install --user-install compass --pre

* JSHint: see http://www.jshint.com/install/

* We don't duplicate the OpenSeadragon sprites: external/openseadragon is a git submodule which pulls in the
  soon-to-be-released OpenSeadragon v0.9.129 release and the ``make sprite`` target will symlink it to where
  Compass expects to find it

* Note that for your projects, wdl-viewer.scss attempts to abstract the parts you'd most want to customize –
  i.e. the seadragon controls and colors — so more involved reskinning projects should simply be able to
  define a ``seadragon-controls`` sprite with custom images or set the variables controlling viewport size
  breakpoints or colors by creating a project-specific fork of wdl-viewer.scss.

Building
--------

1. ``make`` will compile the CSS and sprites
2. ``make runserver`` will launch a local webserver for development
3. open http://127.0.0.1:8000/examples/first-folio.html

Integration
-----------

The ``examples/first-folio.html`` file shows what a full integration scenario looks like, including several
polyfills for browser feature fallbacks, and the use of jQuery custom events to interact with the viewer or
react to stage changes by doing things like recording page views in your analytics service.

The current implementation is a jQuery plugin which adds a `wdlViewer` method which takes a configuration
object. Until formal documentation is available, consult the first-folio.html example.


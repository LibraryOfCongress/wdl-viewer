SPRITE_ROOT=src/img/sprites

all: openseadragon jshint static

clean:
	rm -rf build/wdl-viewer.*
	cd external/openseadragon && grunt clean

openseadragon:
	cd external/openseadragon && grunt

jshint:
	jshint src/js/wdl-viewer.js

tidy:
	tidy-html5 -utf8 -m -quiet --tidy-mark no --wrap 0 --indent yes --indent-spaces 4 examples/*.html

sprite:
	mkdir -p ${SPRITE_ROOT}/seadragon-controls/
	for f in external/openseadragon/images/*_{rest,hover,pressed}.png; do \
		DEST_FILE=$${f##*/}; \
		DEST_FILE=$${DEST_FILE/_rest/}; \
		DEST_FILE=$${DEST_FILE/_pressed/_active}; \
		ln -f $$f ${SPRITE_ROOT}/seadragon-controls/$${DEST_FILE}; \
	done

static: sprite
	compass compile

runserver: all
	python -m SimpleHTTPServer
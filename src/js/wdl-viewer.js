/*global navigator, window, document, Element, Modernizr, jQuery, Image, OpenSeadragon */

(function ($) {
    "use strict";
    var $window = $(window),
        placeholderImage = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

    var gettext = window.gettext;
    if (typeof(gettext) == "undefined") {
        // intentionally does nothing but avoids breaking if JS I18N dict fails to load
        gettext = function (i) { return i; };
    }

    function isFullScreen() {
        return ((document.fullScreenElement && document.fullScreenElement !== null) ||
                (!document.mozFullScreen && !document.webkitIsFullScreen));
    }

    function enterFullscreen() {
        var doc = document.documentElement;
        if (doc.requestFullscreen) {
            doc.requestFullscreen();
        } else if (doc.webkitRequestFullscreen) {
            doc.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
        } else if (doc.mozRequestFullScreen) {
            doc.mozRequestFullScreen();
        }
    }

    function leaveFullscreen() {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.cancelFullscreen) {
            document.cancelFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.webkitCancelFullScreen) {
            document.webkitCancelFullScreen();
        }
    }

    function toggleFullscreen() {
        if (isFullScreen()) {
            enterFullscreen();
        } else {
            leaveFullscreen();
        }
    }

    $window.on("fullscreenchange mozfullscreenchange webkitfullscreenchange msfullscreenchange", function () {
        $window.trigger("resize");
    });

    // TODO: Finish refactoring this out of being a jQuery plugin
    $.fn.wdlViewer = function (config) {
        return this.each(function View(idx, elm) {
            return new ViewController(elm, config);
        });
    };

    function ViewController(elm, config) {
        var controller = this, // Convenience alias for event handlers…
            $viewer = $(elm),
            $header = $viewer.find("header"),
            $footer = $viewer.find("footer"),
            $help = $("#help").removeClass("hidden").hide(),
            $pages = $("#pages"),
            $grid = $('<div id="grid"></div>').hide().insertAfter($pages),
            $seadragon = $('<div id="seadragon"></div>').hide().insertAfter($pages),
            $groupControl = $("#group"),
            $indexControl = $("#index");

        // We still want to allow custom events and some jQuery convenience, so we'll expose these to views:
        this.viewer = $viewer;
        this.footer = $footer;
        this.header = $header;

        this.config = config;
        this.rotation = config.viewportRotation || 0;
        this.searchText = "";

        config.placeholderSrc = config.placeholderSrc || placeholderImage;
        // TODO: Adjust image max size based on the viewport
        config.maxPageEdge = 1024;
        config.maxThumbnailEdge = 256;

        // These control the state of the overall View (pagination, search, etc.) but not the individual
        // page displays:
        this.currentGroup = parseInt($groupControl.val(), 10) || 1;
        this.currentIndex = parseInt($indexControl.val(), 10) || 1;
        this.maxIndex = config.pageGroups[this.currentGroup] || 1;

        // Hide the group selection button if we only have one item:
        if ($groupControl.children().length < 2) {
            $groupControl.parent().hide();
        }

        if ($.isFunction(config.imageUrlTemplate)) {
            this.generateImageUrl = config.imageUrlTemplate;
        }

        if ($.isFunction(config.pageUrlTemplate)) {
            this.generatePageUrl = config.pageUrlTemplate;
        }

        if ($.isFunction(config.dziUrlTemplate)) {
            this.generateDziUrl = config.dziUrlTemplate;
        }

        this.pageView = new PageView(this, $pages, config);

        if (config.dziUrlTemplate) {
            this.seadragonView = new SeadragonView(this, $seadragon, config);
        }

        this.gridView = new GridView(this, $grid, config);
        this.activeView = this.pageView;

        // Add toolbar features which only work with JavaScript:
        if (Modernizr.canvas || Modernizr.csstransforms) {
            $('<button id="rotate-left" class="requires-rotation" type="button"></button>')
                .append($('<span class="fa fa-rotate-left"></span>'))
                .append($('<span class="title">').text(gettext('Rotate Left')))
                .appendTo("footer .toolbar .controls")
                .on("click", $.proxy(function () {
                    this.rotate(true);
                }, this));

            $('<button id="rotate-right" class="requires-rotation" type="button"></button>')
                .append($('<span class="fa fa-rotate-right"></span>'))
                .append($('<span class="title">').text(gettext('Rotate Right')))
                .appendTo("footer .toolbar .controls")
                .on("click", $.proxy(function () {
                    this.rotate();
                }, this));
        }

        if (this.seadragonView) {
            $('<button id="toggle-seadragon" type="button"></button>')
                .append($('<span class="fa fa-search-plus"></span>'))
                .append($('<span class="title">').text(gettext('Zoom')))
                .appendTo("footer .toolbar .controls")
                .on("click", $.proxy(function () {
                    if (this.activeView == this.seadragonView) {
                        this.openPageView();
                    } else {
                        this.openSeadragonView();
                    }
                }, this));
        }

        $('<button id="toggle-grid" type="button"></button>')
            .append($('<span class="fa fa-th-large"></span>'))
            .append($('<span class="title">').text(gettext('Grid')))
            .appendTo("footer .toolbar .controls")
            .on("click", $.proxy(function () {
                if (this.activeView == this.gridView) {
                    this.openPageView();
                } else {
                    this.openGridView();
                }
            }, this));

        if ($("html").hasClass("fullscreen")) {
            $('<button id="toggle-fullscreen" type="button"></button>')
                .append($('<span class="fa fa-arrows-alt"></span>'))
                .append($('<span class="title">').text(gettext('Full Screen')))
                .appendTo("footer .toolbar .controls")
                .on("click", function () {
                    toggleFullscreen();
                });
        }

        $('<button id="toggle-help" type="button"></button>')
            .append($('<span class="fa fa-question-circle"></span>'))
            .append($('<span class="title">').text(gettext('Help')))
            .appendTo("footer .toolbar .controls")
            .on("click", function () {
                $("#help").toggle();
            });

        if (config.fts) {
            var $search = $('<div id="content-search" class="controls"></div>')
                            .appendTo('footer .toolbar')
                            .hide(),
                q = $.deparam(document.location.hash).q;

            this.setSearchText($.deparam(document.location.hash).q || "");
            this.loadSearchResultPageList();
            this.search = new WDL.ItemSearchController($search.get(0), $viewer, config);

            var $searchToggle = $('<button id="toggle-search" type="button"></button>')
                .append($('<span class="fa fa-search"></span>'))
                .append($('<span class="title">').text(gettext('Search')))
                .appendTo('footer .toolbar .controls:first')
                .on("click", function () {
                    $("#content-search").toggle()
                        .find("input[type=search]")
                            .trigger("focus");
                    $searchToggle.toggleClass("active");
                });

            if (q) {
                this.search.setQuery(q);
            }

            if (this.search.query) {
                $searchToggle.trigger("click");
            }

            $viewer.on("search-query-changed", function (evt, newQuery) {
                if (newQuery) {
                    document.location.hash = "q=" + encodeURIComponent(newQuery);
                    $("a.item-detail").each(function () {
                        this.href = this.href.replace(/($|#.*$)/, document.location.hash);
                    });
                } else {
                    document.location.hash = "";
                }

                controller.activeView.updateSearch();
            });
        }

        // Set the title attribute on footer controls so the standard browser tooltip effect will work:
        $footer.find('.control, button').find('.title').each(function (idx, title) {
            var $title = $(title);
            $title.parents('.control, button').attr('title', $title.text());
        });

        $groupControl.on("change", function() {
            controller.setGroup(parseInt($groupControl.val(), 10));
        });

        $indexControl.on("change", function() {
            controller.setIndex(parseInt($indexControl.val(), 10));
        });

        $viewer.find("input.current-index").on("change", function() {
            // This is actually less painful than trying to get <input type=number> to work cross-browser…
            var val = parseInt(this.value, 10);
            if (val == controller.currentIndex || isNaN(val) || val < 0 || val > controller.maxIndex) {
                this.value = controller.currentIndex;
                return false;
            }

            controller.setIndex(val);
        });

        $(document).on("keydown", $.proxy(function (evt) {
            if ($help.is(':visible')) {
                $help.hide();
                return false;
            }

            // Allow views to override:
            if (this.activeView.onKeydown) {
                var res = this.activeView.onKeydown(evt);
                if (typeof(res) != "undefined") {
                    return res;
                }
            }

            if (evt.metaKey || evt.altKey) {
                if (evt.which == 37 || evt.which == 39) {
                    this.rotate(evt.which == 37);
                    return false;
                } else {
                    // Allow normal handling to avoid interfering with normal browser controls:
                    return true;
                }
            }

            // Global state changes:
            switch (evt.which) {
                case 71: // g
                    $("#toggle-grid").trigger("click");
                    return false;
                case 191: // ?
                    $help.show();
                    return false;
                case 90: // z
                    $("#toggle-seadragon").trigger("click");
                    return false;
                case 70: // f
                    $("#toggle-fullscreen").trigger("click");
                    return false;
                case 27: // esc
                    leaveFullscreen();
                    return false;
                case 32: // Space bar
                    if (evt.shiftKey) {
                        this.goToPreviousPage();
                    } else {
                        this.goToNextPage();
                    }
                    return false;

                case 74: // j
                case 34: // Page Down
                    this.goToNextPage();
                    return false;

                case 75: // k
                case 33: // Page Up
                    this.goToPreviousPage();
                    return false;

                case 37: // left arrow
                    this.goToPreviousPage();
                    return false;

                case 39: // right arrow
                    this.goToNextPage();
                    return false;
            }

            // Fall through to normal browser default handling:
            return true;
        }, this));

        $help.on("click", function () {
            $help.hide();
        });

        $viewer.on("goto-next-page", $.proxy(this.goToNextPage, this));
        $viewer.on("goto-previous-page", $.proxy(this.goToPreviousPage, this));

        $viewer.on("goto-page", function (evt, newGroup, newIndex) {
            controller.setGroup(parseInt(newGroup, 10), parseInt(newIndex, 10));
        });

        /*
            We offer two convenience functions for event handlers which increment the current rotation as
            well as a way to set the current rotation directly:
        */
        $viewer.on("rotate-left", function () {
            controller.rotate(true);
        });
        $viewer.on("rotate-right", function () {
            controller.rotate();
        });
        $viewer.on("set-rotation", function (evt, degrees) {
            controller.setRotation(degrees);
        });

        $viewer.on("page-changed", $.proxy(function () {
            $groupControl.val(this.currentGroup);
            $indexControl.val(this.currentIndex);
            $viewer.find('input.current-index').attr('max', this.maxIndex).val(this.currentIndex);
            $viewer.find('.max-index').text(this.maxIndex);
            $indexControl.attr('max', this.maxIndex);
        }, this));

        $viewer.on("prefetch-adjacent-pages", $.proxy(function () {
            this.activeView.prefetch();
        }, this));

        $window.on("resize", $.proxy(function () {
            this.activeView.onResize();
        }, this));

        $viewer.on("open-seadragon", $.proxy(function () { this.openSeadragonView(); }, this));

        // For efficiency we'll expose a variable which event handlers can use to decide whether to make an
        // expensive jQuery call:

        var headerHidden = false;
        $viewer.on("hide-header", function () {
            if (!headerHidden) {
                headerHidden = true;
                $header.stop(true, true).slideUp();
            }
        });
        $viewer.on("show-header", function () {
            if (headerHidden) {
                headerHidden = false;
                $header.stop(true, true).slideDown();
            }
        });

        var footerHidden = false;
        $viewer.on("hide-footer", $.proxy(function () {
            // Don't hide the footer when the seadragon view is active as there's no way to restore it
            // without using keyboard shortcuts:
            if (!footerHidden && (this.activeView != this.seadragonView)) {
                footerHidden = true;
                $footer.stop(true, true).slideUp();
            }
        }, this));

        $viewer.on("show-footer", function () {
            if (footerHidden) {
                footerHidden = false;
                $footer.stop(true, true).slideDown();
            }
        });

        var headerHeight = $header.height();

        $viewer.on("mousemove", function (evt) {
            if (evt.pageY < headerHeight * 2) {
                $viewer.trigger("show-header");
            } else if (evt.pageY > headerHeight * 3) {
                $viewer.trigger("hide-header");
            }
        });

        $viewer.on("hide-chrome", function () {
            $viewer.trigger("hide-header");
            $viewer.trigger("hide-footer");
        });

        $viewer.on("show-chrome", function () {
            $viewer.trigger("show-header");
            $viewer.trigger("show-footer");
        });

        $viewer.on("toggle-chrome", function () {
            if (headerHidden || footerHidden) {
                $viewer.trigger("show-chrome");
            } else {
                $viewer.trigger("hide-chrome");
            }
        });

        $viewer.on("page-changed", function () {
            $viewer.trigger("hide-header");
        });

        if (config.initialView == "grid") {
            this.openGridView();
        } else if (config.initialView == "seadragon") {
            this.openSeadragonView();
        } else {
            this.openPageView();
        }

        this.updateViewer();
    }

    ViewController.prototype = {
        generatePageUrl: function (group, index) {
            var url = this.config.pageUrlTemplate.replace('{group}', group).replace('{index}', index);
            if (this.search && this.search.query) {
                url += "#q=" + encodeURIComponent(this.search.query);
            }
            return url;
        },
        generateWordCoordinatesUrl: function (group, index) {
            return this.config.wordCoordinatesUrlTemplate.replace('{group}', group).replace('{index}', index);
        },
        generateImageUrl: function (group, index, maxEdge) {
            return this.config.imageUrlTemplate.replace(/\{([^}]+)\}/g, function(match, name) {
                switch (name) {
                    case "group":
                        return group;
                    case "index":
                        return index;
                    case "height":
                    case "width":
                        return maxEdge;
                }
            });
        },
        generateDziUrl: function (group, index) {
            return this.config.dziUrlTemplate.replace("{group}", group).replace("{index}", index);
        },
        setIndex: function (newIndex) {
            if (newIndex < 1) {
                newIndex = 1;
            } else if (newIndex > this.maxIndex) {
                newIndex = this.maxIndex;
            }

            if (newIndex == this.currentIndex) {
                return;
            }

            this.currentIndex = newIndex;

            this.updateViewer();
        },
        setGroup: function (newGroup, newIndex) {
            if (newGroup == this.currentGroup && (!newIndex || newIndex == this.currentIndex)) {
                return;
            }

            this.currentGroup = newGroup;
            this.currentIndex = !!newIndex ? newIndex : 1;
            this.maxIndex = this.config.pageGroups[newGroup];

            this.updateViewer();
        },
        updateViewer: function () {
            // Update next / previous links:
            if (this.currentIndex < this.maxIndex) {
                $(".toolbar .page.next")
                    .removeClass("disabled")
                    .attr("href", this.generatePageUrl(this.currentGroup, this.currentIndex + 1));
            } else {
                $(".toolbar .page.next")
                    .addClass("disabled")
                    .removeAttr("href");
            }

            if (this.currentIndex > 1) {
                $(".toolbar .page.previous")
                    .removeClass("disabled")
                    .attr("href", this.generatePageUrl(this.currentGroup, this.currentIndex - 1));
            } else {
                $(".toolbar .page.previous")
                    .addClass("disabled")
                    .removeAttr("href");
            }

            this.viewer.data({group: this.currentGroup, index: this.currentIndex});

            window.history.replaceState(
                {
                    group: this.currentGroup,
                    index: this.currentIndex
                },
                "Page " + this.currentIndex,
                this.generatePageUrl(this.currentGroup, this.currentIndex)
            );
            this.activeView.update();
            this.viewer.trigger("page-changed");
            this.activeView.prefetch();
        },
        goToNextPage: function () {
            var step = this.activeView.getPageCount(),
                delta = this.maxIndex - this.currentIndex;

            if (delta > 0) {
                this.setIndex(this.currentIndex + step);
            } else {
                 // In case chrome is hidden, display the nav so the user can see they're on the last page:
                this.viewer.trigger("show-chrome");
            }
        },
        goToPreviousPage: function () {
            var step = this.activeView.getPageCount();

            if (this.currentIndex > 1) {
                this.setIndex(this.currentIndex - step);
            } else {
                 // In case chrome is hidden, display the nav so the user can see they're on the first page:
                this.viewer.trigger("show-chrome");
            }
        },
        openPageView: function () {
            if (this.activeView == this.pageView) {
                return;
            } else if (this.activeView) {
                this.activeView.hide();
            }

            this.activeView = this.pageView;
            this.pageView.show();
            this.viewer.attr("data-active-view", "page").trigger("show-footer");
        },
        openGridView: function () {
            if (this.activeView == this.gridView) {
                return;
            } else if (this.activeView) {
                this.activeView.hide();
            }
            this.activeView = this.gridView;
            this.activeView.show();
            this.viewer.attr("data-active-view", "grid").trigger("hide-footer");
        },
        openSeadragonView: function () {
            if (!this.seadragonView || this.activeView == this.seadragonView) {
                return;
            } else if (this.activeView) {
                this.activeView.hide();
            }

            this.activeView = this.seadragonView;
            this.activeView.show();
            this.viewer.attr("data-active-view", "seadragon").trigger("show-footer");
        },
        rotate: function (reverse) {
            this.setRotation(this.rotation + (reverse ? -90 : 90));
        },
        setRotation: function (degrees) {
            this.rotation = degrees;
            if (this.activeView && this.activeView.setRotation) {
                this.activeView.setRotation(this.rotation);
            }
        },
        setSearchText: function (text) {
            this.searchText = $.trim(text);
            if (this.searchText) {
                document.location.hash = "q=" + encodeURIComponent(this.searchText);
                $("a.item-detail").each(function () {
                    this.href = this.href.replace(/($|#.*$)/, document.location.hash);
                });
            } else {
                document.location.hash = "";
            }
        },
        loadSearchResultPageList: function () {
            if (!this.config.fts || !this.config.matchingPagesUrl || !this.searchText) {
                this.searchResultPages = [];
                return;
            }

            WDL.ajaxRetry({
                url: this.config.matchingPagesUrl,
                dataType: "json",
                data: {q: this.searchText}
            }).success($.proxy(function (data) {
                this.searchResultPages = data;
                $("#search .result-count").removeAttr("hidden").text(data.length + " pages");
            }, this));
        }
    };

    function PageView(controller, $container, config) {
        this.controller = controller;
        this.config = config;

        var $pages = $("#pages"),
            $currentPage = $pages.find(".current img").first(),
            $nextPage = $('<img>'),
            previousImages = [new Image(), new Image(), new Image()],
            nextImages = [new Image(), new Image(), new Image()];

        $currentPage.parent().clone().empty().removeClass("current").addClass("next")
            .appendTo($pages)
            .append($nextPage);

        this.hide = function () {
            $container.hide();
        };

        this.show = function () {
            $container.show();
            this.update();
        };

        this.setRotation = function (degrees) {
            // We set this explicitly here rather
            $pages.css({
               '-webkit-transform': 'rotate(' + degrees + 'deg)',
               '-ms-transform':     'rotate(' + degrees + 'deg)',
               'transform':         'rotate(' + degrees + 'deg)'
            });

            this.checkViewportConstraints();
        };

        this.getPageCount = function () {
            return $pages.find("img:visible").length;
        };

        this.update = function() {
            // Cycle the sources to avoid issues with the load event not firing on cache hits:
            var newSrc = controller.generateImageUrl(controller.currentGroup, controller.currentIndex,
                                                     config.maxPageEdge);
            if (newSrc != $currentPage.attr("src")) {
                $pages.find("img").fadeTo(200, 0.3);
                $currentPage.attr("src", newSrc);
            }

            /*
                    We'll set our own dirty flag because we can't rely on the HTML5 img.complete property
                    when an error occurs while loading an image:

                      https://bugs.webkit.org/show_bug.cgi?id=28832
                      https://bugzilla.mozilla.org/show_bug.cgi?id=513541
                */
            $nextPage.hide()
                .attr("src", this.config.placeholderSrc)
                .data("dirty", true);

            if ((controller.maxIndex - controller.currentIndex) > 0) {
                $nextPage.attr("src", controller.generateImageUrl(controller.currentGroup,
                                                                  controller.currentIndex + 1,
                                                                  config.maxPageEdge));
            } else {
                $nextPage.hide();
            }

            this.setRotation(this.controller.rotation);
            this.updateSearch();
        };

        this.checkViewportConstraints = function() {
            if ($nextPage.data("dirty")) {
                return;
            }

            var lastPage = ((this.controller.maxIndex - this.controller.currentIndex) < 1);

            var overflow = false;

            // CSS transforms rotate display but not the DOM element's height/width:
            if (this.controller.rotation % 180 === 0) {
                overflow = ($nextPage.outerWidth() + $currentPage.outerWidth() + 20 >= $window.width());
            } else {
                overflow = ($nextPage.outerHeight() + $currentPage.outerHeight() + 20 >= $window.height());
            }

            if (lastPage || overflow) {
                $nextPage.hide();
            } else {
                $nextPage.show()
                    .stop(true, false)
                    .fadeTo(200, 1.0);
            }
        };

        this.onResize = function () {
            return this.checkViewportConstraints();
        };

        this.prefetch = function () {
            for (var i = 0; i < 3; i++) {
                nextImages[i].src = controller.generateImageUrl(
                    controller.currentGroup,
                    Math.min(controller.maxIndex, controller.currentIndex + 1 + i),
                    config.maxPageEdge
                );
            }

            for (i = 0; i < 3; i++) {
                previousImages[i].src = controller.generateImageUrl(
                    controller.currentGroup,
                    Math.max(1, controller.currentIndex - (1 + 1)),
                    config.maxPageEdge
                );
            }
        };

        this.updateSearch = function () {
            if (!config.fts || !controller.search || !controller.search.query) {
                return;
            }

            $pages.find(".highlighted").remove();

            var terms = controller.search.terms;

            this.applySearchHighlighting(controller.currentGroup, controller.currentIndex, terms);
            if (controller.currentIndex < controller.maxIndex) {
                this.applySearchHighlighting(controller.currentGroup, controller.currentIndex + 1, terms);
            }
        };

        this.applySearchHighlighting = function (group, index, terms) {
            WDL.ajaxRetry({
                url: controller.generateWordCoordinatesUrl(group, index, terms),
                success: function (data) {
                    if (group != controller.currentGroup ||
                        (index != controller.currentIndex && index != controller.currentIndex + 1)) {
                        return;
                    }

                    var $page = index == controller.currentIndex ? $currentPage : $nextPage;

                    var master_height = data.height,
                        master_width = data.width;

                    $.each(data.words, function (k, v) {
                        if (!WDL.Search.inTerms(k, terms)) {
                            return;
                        }

                        // Response format is x1, y1, x2, y2
                        for (var i=0; i < v.length; i++) {
                            var coords = v[i];

                            $('<div class="highlighted">').css({
                                "left":     WDL.Search.formatPercentage(coords[0] / master_width),
                                "top":      WDL.Search.formatPercentage(Math.max(0, (coords[3] / master_height) - 0.01)),
                                "right":    WDL.Search.formatPercentage(1.0 - coords[2] / master_width),
                                "bottom":   WDL.Search.formatPercentage(1.0 - Math.min(1.0, (coords[1] / master_height) + 0.01)),
                            }).insertAfter($page);
                        }
                    });
                }
            });
        };

        $currentPage.on("load", $.proxy(function () {
            $currentPage.stop(true, false).fadeTo(100, 1.0);
            $window.scrollTop(0);
            this.checkViewportConstraints();
        }, this));

        $nextPage
            .on("load", $.proxy(function () {
                $nextPage.data("dirty", false);
                this.checkViewportConstraints();
            }, this))
            .on("error", function () {
                // TODO: Consider trying a reload?
                $nextPage.data("dirty", false);
            });
    }

    function SeadragonView(controller, $container) {
        this.controller = controller;
        this.seadragon = null;

        this.getPageCount = function () {
            return 1;
        };

        this.onResize = function () {
            $container.css({
                height: $window.height()
            });
        };

        this.hide = function () {
            $('#toggle-seadragon .title').text(gettext('Zoom'));

            if (this.seadragon) {
                this.seadragon.close();
                this.seadragon.destroy();
                this.seadragon = null;
            }

            $container.hide();
            $window.off("resize", this.onResize);
        };

        this.show = function () {
            $('#toggle-seadragon .title').text(gettext('Read'));

            if (this.seadragon) {
                this.seadragon.close();
                this.seadragon.destroy();
                this.seadragon = null;
            }

            // We'll work around Internet Explorer < 11's broken height:100% calculation
            // by displaying now to force the height to match the window:
            $container.show();
            this.onResize();
            $window.on("resize", this.onResize);
            this.update();
        };

        this.update = function () {
            var dziUrl = this.controller.generateDziUrl(this.controller.currentGroup,
                                                        this.controller.currentIndex);

            if (!this.seadragon) {
                this.initializeSeadragon(dziUrl);
            } else {
                this.seadragon.open(dziUrl);
            }
        };

        // TODO: find a better way to consolidate this with the page-turner implementation:

        this.zoomIn = $.proxy(function () {
            if (!this.seadragon.viewport) {
                return; // IE8
            }
            this.seadragon.viewport.zoomBy(this.seadragon.zoomPerClick / 1.0);
        }, this);

        this.zoomOut = $.proxy(function () {
            if (!this.seadragon.viewport) {
                return; // IE8
            }
            this.seadragon.viewport.zoomBy(1.0 / this.seadragon.zoomPerClick);
        }, this);

        this.goHome = $.proxy(function () {
            if (!this.seadragon.viewport) {
                return; // IE8
            }
            this.seadragon.viewport.goHome();
        }, this);

        this.panViewport = $.proxy(function (direction) {
            if (!this.seadragon.viewport) {
                return; // IE8
            }

            var bounds = this.seadragon.viewport.getBounds();
            var delta = new OpenSeadragon.Point();

            switch (direction) {
                case "down":
                    delta.y = bounds.height * 0.2;
                    break;
                case "up":
                    delta.y = bounds.height * -0.2;
                    break;
                case "left":
                    delta.x = bounds.width * -0.2;
                    break;
                case "right":
                    delta.x = bounds.width * 0.2;
                    break;
            }

            this.seadragon.viewport.panBy(delta);
        }, this);

        this.setRotation = $.proxy(function (degrees) {
            if (!this.seadragon || !this.seadragon.viewport) {
                return;
            }

            // Until https://github.com/openseadragon/openseadragon/issues/194 lands we can't support
            // arbitrary rotation:
            this.seadragon.viewport.setRotation(degrees - (degrees % 90));
        });

        this.initializeSeadragon = function (dziUrl) {
            var seadragon = new OpenSeadragon({
                id: $container.attr("id"),
                prefixUrl: this.controller.config.seadragonPrefixUrl,
                tileSources: dziUrl,
                autoHideControls: false,
                immediateRender: navigator.userAgent.match(/mobile/i),
                showNavigator: false,
                showNavigationControl: false
            });

            this.seadragon = seadragon;

            var controlAnchor,
                controls = [
                    $("<a>").text(gettext("Zoom In")).addClass("control zoom-in").click(this.zoomIn),
                    $("<a>").text(gettext("Zoom Out")).addClass("control zoom-out").click(this.zoomOut),
                    $("<a>").text(gettext("Go Home")).addClass("control home").click(this.goHome)
                ];

            try {
                controlAnchor = this.controller.config.openSeadragon.controlAnchor;
            } catch (e) {
                controlAnchor = OpenSeadragon.ControlAnchor.BOTTOM_RIGHT;
            }

            for (var i=0; i < controls.length; i++) {
                seadragon.addControl(controls[i].get(0), {anchor: controlAnchor});
            }

            // Make UI transitions more obvious by zooming in when the viewer first loads:
            var initialZoom = $.proxy(function () {
                seadragon.removeHandler("open", initialZoom);
                this.zoomIn();
            }, this);
            seadragon.addHandler("open", initialZoom);

            seadragon.addHandler("open", $.proxy(function () {
                this.setRotation(this.controller.rotation);
            }, this));
        };

        this.onKeydown = function (evt) {
            switch (evt.which) {
                case 187: // =
                case 61: // = on Firefox
                    this.zoomIn();
                    return false;
                case 189: // -
                case 173: // - on Firefox
                    this.zoomOut();
                    return false;
                case 72: // h
                case 220: // \
                    this.goHome();
                    return false;
                case 37: // Left Arrow: pan Left
                    this.panViewport('left');
                    return false;
                case 39: // Right Arrow: pan Right
                    this.panViewport('right');
                    return false;
                case 38: // Up Arrow: pan Up
                    this.panViewport('up');
                    return false;
                case 40: // Down Arrow: pan Down
                    this.panViewport('down');
                    return false;
            }
        };

        this.prefetch = function () {};
    }

    function GridView(controller, $container, config) {
        var thumbnailUrls = [],
            // Cache for performance in scroll handler:
            container = $container.get(0);

        var gridScrollHandler = $.throttle(50, function () {
            var scrollTop = container.scrollTop,
                scrollBottom = scrollTop + container.offsetHeight,
                thumbnails;

            if (container.querySelectorAll) {
                thumbnails = container.querySelectorAll(".placeholder");
            } else {
                thumbnails = container.children;
            }

            for (var i = thumbnails.length - 1; i >= 0; i--){
                var thumb = thumbnails[i];

                if ((thumb.offsetTop + thumb.offsetHeight) >= scrollTop && thumb.offsetTop <= scrollBottom) {
                    var idx = thumb.id.replace(/^index-/, '');
                    thumb.style.backgroundImage = "url(" + thumbnailUrls[idx] + ")";
                    thumb.className = thumb.className.replace('placeholder', '');
                }
            }
        });

        this.show = function () {
            var container = $container.empty().get(0);

            for (var i=1; i <= controller.maxIndex; i++) {
                var div = document.createElement("div");
                div.id = "index-" + i;
                div.className = "placeholder";
                div.appendChild(document.createTextNode(i));
                thumbnailUrls[i] = controller.generateImageUrl(controller.currentGroup,
                                                               i,
                                                               config.maxThumbnailEdge);
                div.style.backgroundImage = "url(" + config.placeholderSrc + ")";
                container.appendChild(div);
            }

            $container.show();
            this.update();
        };

        this.update = function () {
            var $pages = $container.scrollTop(0).children("div"),
                // Note switch from page number to zero-based index:
                $currentPage = $pages.eq(controller.currentIndex - 1);

            /* jshint -W101 */
            $container.scrollTop($currentPage.offset().top - ($window.height() / 2) + ($currentPage.height() / 2));
            /* jshint +W101 */

            $pages.not($currentPage).filter(".current").removeClass("current");
            $currentPage.addClass("current");

            $container.on("scroll", gridScrollHandler);

            $container.trigger("scroll");

            this.updateSearch();
        };

        this.updateSearch = function () {
            if (!config.fts || !controller.search || !controller.search.query) {
                return;
            }

            var $pages = $container.children();

            $pages.filter(".hit").removeClass("hit");

            var results = controller.search.results;
            for (var i = 0; i < results.length; i++) {
                var result = results[i];
                if (result[0] == controller.currentGroup) {
                    // Note conversion from page numbers to zero-based index:
                    $pages.eq(result[1] - 1).addClass("hit");
                }
            }
        };

        this.hide = function () {
            $container.off("scroll", gridScrollHandler);
            $container.hide().empty();
        };

        this.onResize = function () {
            gridScrollHandler();
        };

        function scrollDown() {
            $container.scrollTop($container.scrollTop() + $window.height() / 2);
        }

        function scrollUp() {
            $container.scrollTop($container.scrollTop() - $window.height() / 2);
        }

        this.onKeydown = function (evt) {
            switch (evt.which) {
                case 32: // Space bar
                    if (evt.shiftKey) {
                        scrollUp();
                    } else {
                        scrollDown();
                    }
                    return false;
                case 74: // j
                case 34: // Page Down
                    scrollDown();
                    return false;
                case 75: // k
                case 33: // Page Up
                    scrollUp();
                    return false;
            }
        };

        this.prefetch = function () {};

        $container.on("click", "div", function () {
            var newPage = this.id.match(/^index-(\d+)/);
            if (newPage) {
                controller.openPageView();
                controller.setIndex(parseInt(newPage[1], 10));
            }
        });
    }
}(jQuery));

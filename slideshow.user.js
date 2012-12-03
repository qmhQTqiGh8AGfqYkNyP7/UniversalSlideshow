// ==UserScript==
// @name Simple slideshow
// @description Adds slideshow to large amount of sites.
// @license MIT
// @version 1.0
// @include *
// ==/UserScript==

(function(window, undefined) {
var w = typeof unsafeWindow != 'undefined' ? unsafeWindow : window;
var doc = w.document;

/*==============================================================================
									Vars
==============================================================================*/

var settings;
var DEFAULT_SETTINGS = {
	/*Boolean*/ 'defaultPlay':       false, //
	/*Boolean*/ 'keepNexthistory':   true,  //
	/*Boolean*/ 'overlayThumbs':     false, //
	/*Boolean*/ 'pinPost':           false, //
	/*Boolean*/ 'random':            false, //
	/*Boolean*/ 'repeat':            false, //
	/*Boolean*/ 'thumbs':            false, //
	/*Boolean*/ 'useHistory':        true,  //
	/*Integer*/ 'controlsHideDelay': 2,     //Delay in seconds
	/*Integer*/ 'maxHistoryLength':  100,   //
	/*Integer*/ 'slidesChangeDelay': 5      //Delay in seconds
};

var profile;
var PROFILES = [
	/*
	{
		'name': Just name, doesn't do anything.
		'test': A function to determine on what site this profile work.
			It moust return:
				 -1 if we're on the right site, but on wrong page, and script should not launch on it.
				  0 if it's not site this profile designed for, shold try something else.
				  1 if that's exactly what we are looking for, launch script.
			There is helper function $checkSite(expr, incl, excl), which takes 3 RegExps as arguments. It works that way:
				It tests window.location.href on each regexp:
					expr - is regexp what matches site current profile shoul work with. (if null - any)
					incl - matches pages on this site. Only on this pages script sould launch. (if null - any)
					excl - matches pages on which script should NOT launch, event if previous expressions was true. (if null - no affect)
				if(expr) {
					if(test && !excl) return 1;
					else return -1;
				} else {
					return 0;
				}
		'scan': A function-parser to find images on page.
			No matter how it works, it must find images we want, and call addSlide(image, thumb, post) for each one, where:
				image (required) - url to full image.
				thumb (optional) - url to small image that will be shown as thumbnail at bottom panel. If null, it will show just a number.
				post  (optional) - image description or any other related text that will be shown at the bottom of image.
			After everything is done, call scanOver() to tell script that we're are ready to begin.
	}
	*/
	{ //............................................................................................................AG.RU
		'name': 'ag.ru',
		'test': function() {
			return $checkSite(/ag\.ru/, /\/games\/.*\/screenshots/, null);
		},
		'scan': function() {
			var temp = $Q('.scrout, .scrout_new', doc);
			for(var i = 0, n = temp.length; i < n; i++) {
				var val = temp[i];
				//thumbs: http://screenshots.ag.ru/ag15/geo/XXXXX/YY.jpg
				//images: http://i.ag.ru/ag/thumbs/XXXXX/YYs.jpg
				var thumb = $q('.screen_cont', val).style.backgroundImage;
					thumb = thumb.substr(5, thumb.length - 7);
				var image = thumb.replace(/i\.ag\.ru\/ag\/thumbs/i, 'screenshots.ag.ru/ag15/geo').replace(/s(?=(-\w)?\.[^(\/)]*$)/i, '');
				var post  = $q('.thumb', val).innerHTML;
				addSlide(image, thumb, post);
			}
			scanOver();
		}
	},
	{ //............................................................................................................RMART.ORG
		'name': 'rmart.org',
		'test': function() {
			return $checkSite(/rmart\.org/);
		},
		'scan': function() {
			var temp = $Q('.thumbnail', doc);
			var i = 0, n = temp.length;
			if(n == 0) {
				scanOver();
				return;
			}
			var step = function() {
				var val = temp[i],
					img = $q('img', val),
					url = val.href,
					thumb = img.src,
					post  = img.alt;
				$getUrl(url, function(xmlhttp) {
					var image = /<img[^<>]*?id=['"]image['"][^<]*src=['"](.*?)['"][^<]*?>/i.exec(xmlhttp.responseText)[1];
					addSlide(image, thumb, post);
					if(++i >= n) scanOver();
					else step();
				});
			};
			step();
		}
	},
	{ //............................................................................................................E621.NET
		'name': 'e621.net',
		'test': function() {
			return $checkSite(/e621\.net/, /\/post/, /\/post\/show\//);
		},
		'scan': function() {
			var temp = $Q('.tooltip-thumb', doc);
			var i = 0, n = temp.length;
			if(n == 0) {
				scanOver();
				return;
			}
			var step = function() {
				var val = temp[i],
					img = $q('img', val),
					url = val.href,
					thumb = img.dataset.original,
					post  = img.alt;
				$getUrl(url, function(xmlhttp) {
					var image = /<a[^<>]*?href=['"](.*?)['"][^<]*?>Download<\/a>/i.exec(xmlhttp.responseText)[1];
					if(!/\.swf$/i.test(image)) addSlide(image, thumb, post);
					if(++i >= n) scanOver();
					else step();
				});
			};
			step();
		}
	},
	{ //............................................................................................................MULTATOR.RU
		'name': 'doodle.multator.ru',
		'test': function() {
			return $checkSite(/doodle\.multator\.ru/, null, /\/thread\//);
		},
		'scan': function() {
			var temp = $Q('.thread_body', doc);
			for(var i = 0, n = temp.length; i < n; i++) {
				var val = null, image = null, post = null;
				for (var j = 0, z = temp[i].childNodes.length; j < z; j++) {
					val = temp[i].childNodes[j];
					if(!post) {
						if($hasClass(val, 'doodle_title')) {
							post = val.innerHTML;
						} else {
							continue;
						}
					} else if($hasClass(val, 'doodle_image')) {
						image = $q('img', val).src;
						addSlide(image, image, post);
						image = null, post = null;
					}
				}
			}
			scanOver();
		}
	},
	{ //............................................................................................................IMAGEBOARDS
		'name': 'imageboard',
		'test': function() {
			var flag = false;
			aib = {};
			aib.url = w.location.href;
			aib.dm = $domain(aib.url);
			switch(aib.dm) {
			case '4chan.org':     aib._4ch = true; flag = true; break;
			case 'krautchan.net': aib.krau = true; flag = true; break;
			case 'britfa.gs':     aib.brit = true; flag = true; break;
			case '420chan.org':   aib._420 = true; flag = true; break;
			case 'sibirchan.ru':  aib.sibi = true; flag = true; break;
			default:
				aib.hana = !!$q('script[src*="hanabira"]', doc);
				aib.futa = !!$q('form[action*="futaba.php"]', doc);
				aib.tiny = !!$q('form[name*="postcontrols"]', doc);
				var foot = $q('body > p.footer', doc);
				if(foot) {
					aib.waka = /wakaba/i.test(foot.innerText);
				}
				if(aib.hana || aib.futa || aib.tiny || aib.waka) flag = true;
			}
			if(flag) {
				// TODO: detect frames and non-board pages
				if(aib.sibi && !(/\/.*\/((\d*|index)\..*)?$/.test(aib.url) || /\/res\/.*$/.test(aib.url))) {
					return 0;
				}
				this.aib = aib;
				return 1;
			}
			return 0;
		},
		'scan': function() {
			var temp = $Q('a', doc);
			for(var i = 0, n = temp.length; i < n; i++) {
				var val = temp[i]
				var image = val.href;
				var t = null, thumb = null, p = null, post = null;
				if(!$isImgExt(image) || $hasClass(val.parentNode, 'filesize') || $hasClass(val.parentNode, 'filename')) {
					continue;
				}
				t = $q('img', val);
				if(!!t) {
					thumb = t.src;
					if(this.aib.krau) {
						p = $q('div > blockquote', val.parentNode.parentNode);
					} else {
						p = val.nextElementSibling;
						while(p && p.tagName.toLowerCase() != 'blockquote') {
							p = p.nextElementSibling;
						}
					}
				} else {
					p = val.parentNode;
					console.log(p);
				}
				console.log(!!t);
				if(p) post = $clearHTML(p.innerHTML);
				addSlide(image, thumb, post);
			}
			scanOver();
		}
	},
	{ //............................................................................................................DEFAULT
		'name': 'default',
		'test': function() {
			var temp = $Q('a', doc);
			for(var i = 0, n = temp.length; i < n; i++) {
				if($isImgExt(temp[i].href)) {
					return 1;
				}
			}
			return 0;
		},
		'scan': function() {
			var temp = $Q('a', doc);
			for(var i = 0, n = temp.length; i < n; i++) {
				var val = temp[i];
				var image = val.href;
				if($isImgExt(image)) {
					var t = $q('img', val);
					var thumb = t ? t.src : null;
					var post = val.innerText || val.textContent;
					addSlide(image, thumb, post);
				}
			}
			scanOver();
		}
	}
];

var timers = {
	slidesChange: null, //
	controlsHide: null, //
};

//state vars
var S = {
	isVisible      : false,
	isPlaying      : false,
	isRandom       : false,
	isRepeat       : false,
	zoomActive     : false,
	imageMouseOver : false,
	ctrlsMouseOver : false
};

//slideshow vars
var slides = []; // Array of Objects {url image, url thumb, string post}
var hist = new SlideshowHistory();

/*
 * @constructor 
 */
function SlideshowHistory() {
	this.index = 0;
	this.array = [];
}

SlideshowHistory.prototype.getCurrent = function() {
	return settings.useHistory ? this.array[this.index] : this.index;
};

//elements
var preloadImg, // Invisible preloader
    currentImg; // Invisible image to determine it's original size

// Tweeners
var thumbScroller;

/*==============================================================================
									UTILITES
==============================================================================*/

// DOM UTILITES

var $cache = {}
function $id(id) {
	return $cache[id] ? $cache[id] : $cache[id] = doc.getElementById(id);
}
function $sid(id) {
	return $id('slideshow_' + id);
}

function $Q(path, root) {
	return root.querySelectorAll(path);
}

function $q(path, root) {
	return root.querySelector(path);
}

function $append(el, nodes) {
	for(var i = 0, n = nodes.length; i < n; i++) {
		if(nodes[i]) {
			el.appendChild(nodes[i]);
		}
	}
}

function $del(el) {
	if(el) {
		el.parentNode.removeChild(el);
	}
}

function $attr(el, attr) {
	for(var key in attr) {
		key === 'text' ? el.textContent = attr[key] :
		key === 'value' ? el.value = attr[key] :
		el.setAttribute(key, attr[key]);
	}
	return el;
}

function $new(tag, attr, events) {
	var el = doc.createElement(tag);
	if(attr) {
		$attr(el, attr);
	}
	if(events) {
		$event(el, events);
	}
	return el;
}

function $New(tag, attr, nodes) {
	var el = $new(tag, attr, null);
	$append(el, nodes);
	return el;
}

// EVENT UTILITES

function $event(el, events) {
	for(var key in events) {
		el.addEventListener(key, events[key], false);
	}
	return el;
}

function $revent(el, events) {
	for(var key in events) {
		el.removeEventListener(key, events[key], false);
	}
}

function $pd(event) {
	event.preventDefault();
}

// REGEXP UTILITES

function $domain(url) {
	return url.match(/\b[a-z0-9]+\b(\.(aero|asia|biz|cat|com|coop|info|int|jobs|mobi|museum|name|net|org|pro|tel|travel|xxx|edu|gov|mil|a[^abhjkpvy]|b[^cklpqux]|c[^bejpqtw]|d[dejkmoz]|e[ceghrstu]|f[ijkmor]|g[^cjkovxz]|h[kmnrtu]|i[delmnoqrst]|j[emop]|k[eghimnprwyz]|l[abcikrstuvy]|m[^bfij]|n[acefgilopruz]|om|p[aefghklmnrstwy]|qa|r[eosuw]|s[^fpqw]|t[^abeiqsuxy]|u[agksyz]|v[aceginu]|w[fs]|y[etu]|z[amw]))+\b/i)[0].replace(/^www\./i, '');
}

function $checkSite(expr, incl, excl) {
	var site = w.location.href.toLowerCase();
	if((expr ? expr.test(site) : true)) {
		if((incl ? incl.test(site) : true) && (excl ? !excl.test(site) : true)) {
			return 1;
		} else {
			return -1;
		}
	}
	return 0;
}

function $cutTag(html, tagName) {
	return html.replace(new RegExp('</?' + tagName + '[^<]*?>', 'ig'), '');
}

function $cutAttr(html, attrName, tags) {
	return html.replace(new RegExp('(<' + tags + '[^<>]*?)(\\s' + attrName + '=(\".*?\"|\'.*?\'))+([^<]*?>)', 'ig'), '$1$4');
}

function $clearHTML(html) {
	return $cutAttr($cutAttr($cutTag(html, '(?:div|img)'), '[^\\s]*?', '[^a][^<>]*?'), '(?:style|class)', 'a');
}

function $isImgExt(url) {
	return /^[^\?]*\.(jpe?g|gif|png|bmp|tiff|tga|svg)$/i.test(url);
}

// CSS UTILITES

function $hasClass(el, className) {
	return (' ' + el.className + ' ').indexOf(' ' + className + ' ') !== -1;
}

function $addClass(el, className) {
	if(!$hasClass(el,className)) {
		if(el.className[el.className.length - 1] != ' ') {
			el.className += ' ';
		}
		el.className += className;
	}
}

function $removeClass(el, className) {
	if($hasClass(el, className)) {
		var reg = new RegExp('(\\s|^)' + className + '(\\s|$)');
		el.className = el.className.replace(reg, ' ');
	}
}

function $toggleClass(el, onClass, offClass, isOn) {
	if(isOn == undefined) isOn = $hasClass(el, offClass);
	$addClass(el,    isOn ? onClass  : offClass);
	$removeClass(el, isOn ? offClass : onClass );
}

function $toggleProperty(el, key, onValue, offValue, isOn) {
	if(isOn == undefined) isOn = el[key] != onValue;
	el[key] = isOn ? onValue : offValue;
}

function $toggleDisplay(el, isVisible) {
	$toggleProperty(el.style, 'display', '', 'none', isVisible);
}

// AJAX UTILITES

function $xhr(){
	try {
		return new ActiveXObject('Msxml2.XMLHTTP');
	} catch(e) {
		try {
			return new ActiveXObject('Microsoft.XMLHTTP');
		} catch(ee) {
		}
	}
	if(typeof XMLHttpRequest != 'undefined') {
		return new XMLHttpRequest();
	}
}

function $getUrl(url, callback) {
	var xmlhttp = $xhr();
	xmlhttp.open("GET", url);
	xmlhttp.onreadystatechange = function() {
		if (xmlhttp.readyState == 4) callback(xmlhttp);
	}
	xmlhttp.setRequestHeader('Content-Type', 'text/xml');
	xmlhttp.send(null);
}

// MISC UTILITES

function $rand(a, b) {
	return Math.floor(a + (Math.random() * (b - a)));
}

/*==============================================================================
									Tweener class
==============================================================================*/

/*
 * @constructor 
 */
function Tweener(getVal, setVal, duration, interval) {
	this.getVal = getVal;
	this.setVal = setVal;
	this.duration = duration;
	this.interval = interval;
}

Tweener.prototype = {
	tweenTo: function(position) {
		this._final = position;
		this._start = this.getVal();
		this._delta = this._final - this._start;
		this._steps = this.duration / this.interval;
		if(this._timer == null) this._doTween(this, 1);
	},
	tweenBy: function(delta) {
		if(this._timer != null) {
			this._final += delta;
			this._delta = this._final - this._start;
		} else {
			this._final = this.getVal() + delta;
			this._start = this.getVal();
			this._delta = this._final - this._start;
			this._steps = this.duration / this.interval;
			this._doTween(this, 1);
		}
	},
	tweenSpeed: function(speed) {
		this._speed = speed;
		if(this._timer == null) this._increment(this);
	},
	_increment: function(self) {
		if(self._speed == 0) {
			self._timer = null;
			return;
		}
		self.setVal(self.getVal() + self._speed);
		self._timer = setTimeout(function() {
			self._increment(self);
		}, self.interval);
	},
	_doTween: function(self, n) {
		if (n > self._steps) {
			self.setVal(self._final);
			self._timer = null;
			return;
		}
		self.setVal(self._start + (self._delta / self._steps) * n);
		self._timer = setTimeout(function() {
			self._doTween(self, n + 1);
		}, self.interval);
	},
	_delta: null,
	_final: null,
	_speed: null,
	_start: null,
	_steps: null,
	_timer: null
};

/*==============================================================================
									Array prototype
==============================================================================*/

Array.prototype._indexOfObjectWithValue = function(key, value) {
	for (var i = 0, n = this.length; i < n; i++) {
		var regexp = new RegExp(this[i][key] + '$', 'i');
		if (this[i] && value.match(regexp)) {
			return i;
		}
	}
	return -1;
};

Array.prototype._containsObjectWithValue = function(key, value) {
	return this._indexOfObjectWithValue(key, value) != -1;
};

Array.prototype._difference = function(array) {
    return this.filter(function(i) {return !(array.indexOf(i) > -1);});
};

/*==============================================================================
									Slideshow
==============================================================================*/

function prepareNextImage() {
	var index;
	if(settings.useHistory && hist.index < hist.array.length - 1) {
		index = hist.array[hist.index + 1];
	} else if(settings.random) {
		if(settings.repeat) {
			var current = index = hist.getCurrent();
			while(index == current) index = $rand(0, slides.length);
		} else {
			if(settings.useHistory) {
				var unique = [];
				for (var i = 0, n = slides.length; i < n; i++) {
					if(hist.array.indexOf(i) == -1) unique.push(i);
				}
				if(unique.length != 0) index = unique[$rand(0, unique.length)];
				else togglePause(true);
			} else {
				index = $rand(hist.index + 1, slides.length);
			}
		}
	} else {
		index = hist.getCurrent() + 1;
		if(index >= slides.length) {
			if(settings.repeat) index = 0;
			else index--;
		}
	}
	if(index == undefined) index = hist.getCurrent();
	preloadImg.src = slides[index].image;
}

function updateImage() {
	checkHistoryLength();
	prepareNextImage();
	var currentIndex = hist.getCurrent();

	//Remove last thumb highlight
	var lastThumb = $q('.slideshow_thumb_current', $sid('thumbs'));
	if(lastThumb) $removeClass(lastThumb, 'slideshow_thumb_current');
	//Add highlight to current thumb and scroll to
	var currentThumb = $sid('thumbs').childNodes[currentIndex];
	$addClass(currentThumb, 'slideshow_thumb_current');
	thumbScroller.tweenTo(currentThumb.offsetLeft - (($sid('thumbs_container').offsetWidth - currentThumb.offsetWidth) / 2));

	currentImg.src = slides[currentIndex].image;
	$sid('img').src = ICON_DELAY;
	$sid('btn_thumbs').innerHTML = (currentIndex + 1) + '/' + slides.length;
	$sid('post').innerHTML = slides[currentIndex].post;
	checkPostVisibility(/* */); // No args or undefined
	toggleZoom(false);
}

/*==============================================================================
									Playback
==============================================================================*/

// BUGS, BUGS EVERYWHERE!

function nextImage() {
	if(preloadImg.src == currentImg.src) return;
	if(settings.useHistory) {
		if(hist.index < hist.array.length - 1) {
			hist.index++
		} else {
			hist.array.push(slides._indexOfObjectWithValue('image', preloadImg.src));
			hist.index = hist.array.length - 1;
		}
	} else {
		hist.index = slides._indexOfObjectWithValue('image', preloadImg.src);
	}
	updateImage();
}

function prevImage() {
	hist.index--;
	if(hist.index < 0) {
		if(settings.repeat) {
			if(settings.useHistory) {
				// WTF should be here?
				hist.index = 0;
			} else {
				hist.index = slides.length - 1;
			}
		} else {
			hist.index = 0;
		}
	}
	updateImage();
}

function jumpTo(position) {
	if(!position && position != 0) return;
	if(position < 0 || position >= slides.length) return;
	if(settings.useHistory) {
		if(position == hist.array[hist.index]) return;
		hist.index = Math.min(hist.index + 1, hist.array.length);
		hist.array.splice(hist.index);
		hist.array[hist.index] = position;
	} else {
		if(position == hist.index) return;
		hist.index = position;
	}
	updateImage();
}

function checkHistoryLength() {
	if(!settings.keepNexthistory) {
		hist.array = hist.array.slice(0, hist.index + 1);
	}
	if(settings.random && !settings.repeat) return;
	if(settings.maxHistoryLength != 0 && hist.array.length > settings.maxHistoryLength) {
		var delta = hist.array.length - settings.maxHistoryLength;
		hist.array = hist.array.slice(delta);
		hist.index = hist.index - delta;
	}
}

/*==============================================================================
									Image drgag
==============================================================================*/

function elementMove(event) {
	$sid('img_container').style.left = event.clientX - $sid('img_container').curX + 'px';
	$sid('img_container').style.top  = event.clientY - $sid('img_container').curY + 'px';
}

function stopDrag() {
	$revent(doc.body, {'mousemove': elementMove, 'mouseup': stopDrag});
}

function startDrag() {
	$pd(event);
	if(!S.zoomActive) return;
	$sid('img_container').curX = event.clientX - parseInt($sid('img_container').style.left, 10);
	$sid('img_container').curY = event.clientY - parseInt($sid('img_container').style.top, 10);
	$event(doc.body, {'mousemove': elementMove, 'mouseup': stopDrag});
}

function toggleZoom(isOn) {
	S.zoomActive = isOn != undefined ? isOn : !S.zoomActive;
	if(S.zoomActive) {
		$event($sid('img'), {'mousedown': startDrag});
		$event($sid('img'), {'mousewheel': resizeImage, 'DOMMouseScroll': resizeImage});
	} else {
		stopDrag();
		$revent($sid('img'), {'mousedown': startDrag});
		$revent($sid('img'), {'mousewheel': resizeImage, 'DOMMouseScroll': resizeImage});
	}
	fitImage(S.zoomActive);
}

function resizeImage(event) {
	if(!event.wheelDelta) event.wheelDelta = -event.detail;
	var curX = event.clientX,
		curY = event.clientY,
		oldL = parseInt($sid('img_container').style.left, 10),
		oldT = parseInt($sid('img_container').style.top,  10),
		oldW = parseFloat($sid('img_container').style.width  || $sid('img_container').width),
		oldH = parseFloat($sid('img_container').style.height || $sid('img_container').height),
		newW = oldW * (event.wheelDelta > 0 ? 1.25 : 0.8),
		newH = oldH * (event.wheelDelta > 0 ? 1.25 : 0.8);
	$pd(event);
	$sid('img_container').style.width  = newW + 'px';
	$sid('img_container').style.height = newH + 'px';
	$sid('img_container').style.left = parseInt(curX - (newW/oldW) * (curX - oldL), 10) + 'px';
	$sid('img_container').style.top  = parseInt(curY - (newH/oldH) * (curY - oldT), 10) + 'px';
}

function fitImage(full) {
	if(S.zoomActive && full == undefined) return;
	var thumbsVisible;
	if(settings.overlayThumbs && settings.controlsHideDelay) {
		thumbsVisible = false;
	} else {
		thumbsVisible = $sid('thumbs_container').style.display != 'none' && $sid('thumbs_container').style.display != 'none';
	}
	var ww = w.innerWidth - 20,
	    wh = (thumbsVisible ? w.innerHeight - $sid('thumbs_container').offsetHeight : w.innerHeight) - 20;
	var newWidth,
	    newHeight;
	var oldWidth  = currentImg.width  + 10,
	    oldHeight = currentImg.height + 10;
	if($sid('img').src == ICON_DELAY || $sid('img').src == ICON_CLOSE) {
		newWidth  = 200;
		newHeight = 200;
	} else if(full || (oldWidth < ww && oldHeight < wh)) {
		newWidth  = oldWidth;
		newHeight = oldHeight;
	} else {
		var imageAspectRatio = oldWidth / oldHeight;
		var windowAspectRatio = ww / wh;
		if(windowAspectRatio > imageAspectRatio) {
			newHeight = wh;
			newWidth  = imageAspectRatio * newHeight;
		} else {
			newWidth  = ww;
			newHeight = newWidth / imageAspectRatio;
		}
	}
	$sid('img_container').style.width  = newWidth  + 'px';
	$sid('img_container').style.height = newHeight + 'px';
	$sid('img_container').style.top  = ((wh - newHeight) / 2) + 5 + 'px';
	$sid('img_container').style.left = ((ww - newWidth ) / 2) + 5 + 'px';
}

/*==============================================================================
									Events
==============================================================================*/

var EventHandlers = {
	imageOverOut: {'mouseover': function(){checkPostVisibility(true );},
	                'mouseout' : function(){checkPostVisibility(false);}},
	ctrlsOverOut: {'mouseover': function(){checkControlsVisibility(true );},
	                'mouseout' : function(){checkControlsVisibility(false);}},
	screenMove  : {'mousemove': function(){checkControlsVisibility(/* */);}}, // No arguments or undefined
	imageClick  : {'dblclick' : function(){toggleZoom(/* */);}, 'mousedown': $pd}, // No arguments or undefined

	configChange   : {'change': saveSettings},
	nextImage      : {'click': function(){nextImage();}},
	prevImage      : {'click': function(){prevImage();}},
	togglePause    : {'click': function(){togglePause(/* */);}}, // No arguments or undefined
	toggleRandom   : {'click': function(){toggleRandom();}},
	toggleRepeat   : {'click': function(){toggleRepeat();}},
	toggleThumbs   : {'click': function(){toggleThumbs();}},
	toggleSlideshow: {'click': function(){toggleSlideshow();}},
	toggleSettings : {'click': function(){$toggleDisplay($sid('settings'));}},

	windowResize: {'resize': function(){fitImage(/* */);}}, // No arguments or undefined
	shortcuts: {
		'keydown': function(event) {
			if(event.keyCode == 32 /*space*/) togglePause(/* */); // No arguments or undefined
			else if(event.keyCode == 81 /*q*/ || event.keyCode == 27 /* esc */) toggleSlideshow();
			else if(event.keyCode == 88 /*x*/ || event.keyCode == 39 /*right*/ || event.keyCode == 40 /*down*/) nextImage();
			else if(event.keyCode == 90 /*z*/ || event.keyCode == 37 /*left */ || event.keyCode == 38 /* up */) prevImage();
			else return;
			$pd(event);
		}
	},

	thumbClick: {'click': function(event){jumpTo(event.currentTarget.value);}, 'mousedown': $pd}
};

function toggleSlideshow() {
	S.isVisible = !S.isVisible;
	S.isVisible ? startSlideshow() : stopSlideshow();
}

function toggleThumbs() {
	settings.thumbs = !settings.thumbs;
	$toggleDisplay($sid('thumbs_container'), settings.thumbs);
	saveSettings();
}

function togglePause(isOn) {
	if(isOn == undefined) {
		S.isPlaying = !S.isPlaying;
	} else {
		S.isPlaying = !isOn;
	}
	$toggleClass($q('.slideshow_icon', $sid('btn_play')), 'slideshow_icon_pause', 'slideshow_icon_play', S.isPlaying);
	checkSlideChangeTimer();
}

function checkSlideChangeTimer() {
	clearTimeout(timers.slidesChange);
	if(S.isPlaying) timers.slidesChange = setTimeout(nextImage, settings.slidesChangeDelay * 1000);
}

function toggleRandom() {
	settings.random = !settings.random;
	$toggleClass($q('.slideshow_icon', $sid('btn_random')), 'slideshow_icon_random_a', 'slideshow_icon_random', settings.random);
	saveSettings();
	prepareNextImage();
}

function toggleRepeat() {
	settings.repeat = !settings.repeat;
	$toggleClass($q('.slideshow_icon', $sid('btn_repeat')), 'slideshow_icon_repeat_a', 'slideshow_icon_repeat', settings.repeat);
	saveSettings();
	prepareNextImage();
}

/*==============================================================================
									Show/hide
==============================================================================*/

function checkControlsVisibility(show) {
	if(show != undefined) S.ctrlsMouseOver = show;
	var wasVisible = $sid('controls').style.display != 'none';
	$sid('controls').style.display = '';
	if(!wasVisible) fitImage();
	clearTimeout(timers.controlsHide);
	if(settings.controlsHideDelay != 0 && !S.ctrlsMouseOver) {
		timers.controlsHide = setTimeout(function(){
			$sid('controls').style.display = 'none';
			fitImage();
		}, settings.controlsHideDelay * 1000);
	}
}

function checkPostVisibility(show) {
	if(show != undefined) S.imageMouseOver = show;
	show = (S.imageMouseOver || settings.pinPost) && /\S/.test($sid('post').innerText || $sid('post').textContent);
	if(($sid('post').style.display != 'none' && show) || ($sid('post').style.display == 'none' && !show)) return;
	$toggleDisplay($sid('post'), show);
	forceRedraw();
}

function forceRedraw() {
	$sid('img_container').style.display = 'none';
	$sid('img_container').offsetWidth;
	$sid('img_container').style.display = '';
}

/*==============================================================================
									Launch
==============================================================================*/

function startSlideshow () {
	clearThumbs();
	$sid('load').style.display = '';
	profile.scan();
}

function scanOver() {
	$sid('load').style.display = 'none';
	if(slides.length <= 0) {
		alert(profile.name + '\nNo images found.');
		return;
	}
	for (var i = 0, n = slides.length; i < n; i++) {
		addThumb(slides[i].thumb, i);
	}
	if(hist.array.length <= 0) {
		hist.array[0] = settings.random ? Math.floor(Math.random() * slides.length) : 0;
	}
	if(hist.index + 1 <= hist.array.length) prepareNextImage();
	updateImage();

	if(settings.defaultPlay || S.isPlaying) {
		S.isPlaying = true;
		checkSlideChangeTimer();
	}
	$toggleClass($q('.slideshow_icon', $sid('btn_play')), 'slideshow_icon_pause',    'slideshow_icon_play',   S.isPlaying);
	$toggleClass($q('.slideshow_icon', $sid('btn_random')), 'slideshow_icon_random_a', 'slideshow_icon_random', settings.random);
	$toggleClass($q('.slideshow_icon', $sid('btn_repeat')), 'slideshow_icon_repeat_a', 'slideshow_icon_repeat', settings.repeat);
	$toggleDisplay($sid('thumbs_container'), settings.thumbs);

	$event(doc.body, EventHandlers.shortcuts);
	$sid('menu').style.display = 'none';
	$sid('screen').style.display = '';
	doc.body.style.overflow = 'hidden';
}

function stopSlideshow() {
	$revent(doc.body, EventHandlers.shortcuts);
	clearTimeout(timers.slidesChange);
	$sid('menu').style.display = '';
	$sid('screen').style.display = 'none';
	doc.body.style.overflow = 'auto';
}

function addSlide(image, thumb, post) {
	if(!image) return;
	var dupeIndex = slides._indexOfObjectWithValue('image', image);
	if(dupeIndex != -1) {
		if(!slides[dupeIndex].thumb && thumb) slides[dupeIndex].thumb = thumb;
		if(!slides[dupeIndex].post  && post ) slides[dupeIndex].post  = post;
	} else {
		slides.push({'image': image, 'thumb': thumb, 'post': post});
	}
}

function addThumb(src, n) {
	// "<a class='slideshow_thumb' unselectable='on'><img src='" + src + "'></a>";
	// "<a class='slideshow_thumb' unselectable='on'><div text='" + (n + 1) + "'></a>";
	var thumb = $New('a', {'class': 'slideshow_thumb', 'unselectable': 'on', 'value': n},
		[src ? $new('img', {'src': src, 'class': 'slideshow_thumb_img'}) :
		       $New('div', {'class': 'slideshow_thumb_number', 'unselectable': 'on'}, [$new('span', {'text': (n + 1)})])
		]
	);
	$event(thumb, EventHandlers.thumbClick);
	$append($sid('thumbs'), [thumb]);
}

function removeThumb(thumb) {
	$revent(thumb, EventHandlers.thumbClick);
	$del(thumb);
}

function clearThumbs() {
	var thumbs = $sid('thumbs');
	while(thumbs.childNodes.length) {
		removeThumb(thumbs.childNodes[0]);
	}
}

/*==============================================================================
							Script initialization
==============================================================================*/

function addHTML() {
	var div = $new('div', {'id': 'slideshow', 'class': 'slideshow'});
	div.innerHTML = SLIDESHOW_HTML;
	$append(doc.body, [div]);
}

function addCSS() {
	$append(doc.head, [$new('style', {'type': 'text/css', 'text': SLIDESHOW_CSS})]);
}

function addElements() {
	preloadImg = $new('img'); // Invisible preloader
	currentImg = $new('img', null, {'load': function() {
		$sid('img').src = currentImg.src;
		checkSlideChangeTimer();
		fitImage();
	}});
}

function loadSettings() {
	var storage = w.localStorage.getItem('slideshow_settings');
	if(storage == null) {
		settings = DEFAULT_SETTINGS;
	} else {
		settings = JSON.parse(storage);
	}

	$sid('settings_b_defaultPlay').checked     = settings.defaultPlay;
	$sid('settings_b_keepNexthistory').checked = settings.keepNexthistory;
	$sid('settings_b_overlayThumbs').checked   = settings.overlayThumbs;
	$sid('settings_b_pinPost').checked         = settings.pinPost;
	$sid('settings_b_useHistory').checked      = settings.useHistory;
	$sid('settings_i_controlsHideDelay').value = settings.controlsHideDelay;
	$sid('settings_i_maxHistoryLength').value  = settings.maxHistoryLength;
	$sid('settings_i_slidesChangeDelay').value = settings.slidesChangeDelay;

	updateSettings();
}

function updateSettings() {
	if(settings.pinPost) {
		$revent($sid('img_container'), EventHandlers.imageOverOut);
	} else {
		$event($sid('img_container'),  EventHandlers.imageOverOut);
	}
	checkPostVisibility(settings.pinPost);

	fitImage();
}

function saveSettings() {
	settings.defaultPlay       = $sid('settings_b_defaultPlay').checked;
	settings.keepNexthistory   = $sid('settings_b_keepNexthistory').checked;
	settings.overlayThumbs     = $sid('settings_b_overlayThumbs').checked;
	settings.pinPost           = $sid('settings_b_pinPost').checked;
	settings.useHistory        = $sid('settings_b_useHistory').checked;
	settings.controlsHideDelay = $sid('settings_i_controlsHideDelay').value;
	settings.maxHistoryLength  = $sid('settings_i_maxHistoryLength').value;
	settings.slidesChangeDelay = $sid('settings_i_slidesChangeDelay').value;

	w.localStorage.setItem('slideshow_settings', JSON.stringify(settings));
	updateSettings();
}

function addListeners() {
	$event($sid('btn_next'),     EventHandlers.nextImage      );
	$event($sid('btn_prev'),     EventHandlers.prevImage      );
	$event($sid('btn_play'),     EventHandlers.togglePause    );
	$event($sid('btn_random'),   EventHandlers.toggleRandom   );
	$event($sid('btn_repeat'),   EventHandlers.toggleRepeat   );
	$event($sid('btn_thumbs'),   EventHandlers.toggleThumbs   );
	$event($sid('btn_settings'), EventHandlers.toggleSettings );
	$event($sid('btn_start'),    EventHandlers.toggleSlideshow);
	$event($sid('btn_close'),    EventHandlers.toggleSlideshow);

	$event($sid('screen'),   EventHandlers.screenMove  );
	$event($sid('controls'), EventHandlers.ctrlsOverOut);

	$event($sid('settings_b_defaultPlay'),       EventHandlers.configChange);
	$event($sid('settings_b_keepNexthistory'),   EventHandlers.configChange);
	$event($sid('settings_b_overlayThumbs'),     EventHandlers.configChange);
	$event($sid('settings_b_pinPost'),           EventHandlers.configChange);
	$event($sid('settings_b_useHistory'),        EventHandlers.configChange);
	$event($sid('settings_i_controlsHideDelay'), EventHandlers.configChange);
	$event($sid('settings_i_maxHistoryLength'),  EventHandlers.configChange);
	$event($sid('settings_i_slidesChangeDelay'), EventHandlers.configChange);

	thumbScroller = new Tweener(function(){return $sid('thumbs_container').scrollLeft;},
		                        function(value){$sid('thumbs_container').scrollLeft = value;},
		                        500, 30);

	var scrollThumbsByWheel = function(event) {
		if(!event.wheelDelta) event.wheelDelta = -40 * event.detail;
		$pd(event);
		thumbScroller.tweenBy(-event.wheelDelta);
	};
	$event($sid('thumbs_container'), {'mousewheel': scrollThumbsByWheel, 'DOMMouseScroll': scrollThumbsByWheel});

	$event($sid('img'), EventHandlers.imageClick);

	$event(w, EventHandlers.windowResize);

	addScrollButton($sid('thumbs_scroll_left'),  thumbScroller, -10, -30);
	addScrollButton($sid('thumbs_scroll_right'), thumbScroller,  10,  30);
}

function addScrollButton(el, tweener, overSpeed, downSpeed) {
	var scr = el.scroller = new Object();
	scr.tweener   = tweener;
	scr.overSpeed = overSpeed;
	scr.downSpeed = downSpeed;

	scr.mouseIsOver = false;
	scr.mouseIsDown = false;

	scr._eventOver = {'mouseover': function() {
		$event(el, scr._eventOut);
		$revent(el, scr._eventOver);
		scr.mouseIsOver = true;
		scr.checkScroll();
	}};
	scr._eventOut  = {'mouseout' : function() {
		$event(el, scr._eventOver);
		$revent(el, scr._eventOut);
		scr.mouseIsOver = false;
		scr.checkScroll();
	}};
	scr._eventDown = {'mousedown': function() {
		$event(w, scr._eventUp);
		$revent(el, scr._eventDown);
		scr.mouseIsDown = true;
		scr.checkScroll();
	}};
	scr._eventUp   = {'mouseup'  : function() {
		$event(el, scr._eventDown);
		$revent(w, scr._eventUp);
		scr.mouseIsDown = false;
		scr.checkScroll();
	}};

	scr.checkScroll = function() {
		scr.tweener.tweenSpeed(scr.mouseIsDown ?  scr.downSpeed : scr.mouseIsOver ?  scr.overSpeed : 0);
	};

	$event(el, scr._eventOver);
	$event(el, scr._eventDown);
}

function main() {
	addHTML();
	addCSS();
	addElements();
	addListeners();
	loadSettings();
}

/*==============================================================================
									CSS
==============================================================================*/

// SVG icons from Iconic icon set http://somerandomdude.com/work/iconic/
//Icons encoded in base64 because Opera have bug with raw svg in url()
var /*CONST String*/ PRE  = 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0nMS4wJyBlbmNvZGluZz0ndXRmLTgnPz48IURPQ1RZUEUgc3ZnIFBVQkxJQyAnLS8vVzNDLy9EVEQgU1ZHIDEuMS8vRU4nICdodHRwOi8vd3d3LnczLm9yZy9HcmFwaGljcy9TVkcvMS4xL0RURC9zdmcxMS5kdGQnPjxzdmcgdmVyc2lvbj0nMS4xJyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHhtbG5zOnhsaW5rPSdodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rJyB3aWR0aD0nM';
var /*CONST String*/ RND1 = 'zInIGhlaWdodD0nMzInPjxnPjxwYXRoIHN0eWxlPSdmaWxsOi';
var /*CONST String*/ RND2 = '7JyBkPSdNMjEuNzg2LDIwLjY1NGMtMC42MTgtMC4xOTUtMS40MDctMC43MDMtMi4yOTEtMS41ODdjLTAuNzU3LTAuNzQyLTEuNTM5LTEuNjk4LTIuMzQtMi43NDFjLTAuMTkxLDAuMjU2LTAuMzgyLDAuNTEtMC41NzQsMC43N2MtMC41MjQsMC43MDktMS4wNTksMS40MjQtMS42MDQsMi4xMjdjMS45MDQsMi4zMSwzLjg4LDQuNTc4LDYuODA5LDQuOTUydjIuNzAxbDcuNTU2LTQuMzYybC03LjU1Ni00LjM2MlYyMC42NTR6TTkuMTkyLDExLjkzM2MwLjc1NiwwLjc0MSwxLjUzOCwxLjY5NywyLjMzOSwyLjczOWMwLjE5NS0wLjI2MiwwLjM5LTAuNTIxLDAuNTg3LTAuNzg4YzAuNTItMC43MDMsMS4wNTEtMS40MTIsMS41OTItMi4xMWMtMi4wMzItMi40NjMtNC4xMzMtNC45MDctNy4zOTYtNS4wMjVoLTMuNXYzLjVoMy41QzYuOTY5LDEwLjIyMyw3Ljk5NiwxMC43MzUsOS4xOTIsMTEuOTMzek0yMS43ODYsMTAuMzQxdjIuNTM1bDcuNTU2LTQuMzYzbC03LjU1Ni00LjM2M3YyLjY0N2MtMS45MDQsMC4yMTktMy40MjUsMS4zNDgtNC43NTEsMi42NDRjLTIuMTk2LDIuMTgzLTQuMTE2LDUuMTY3LTYuMDExLDcuNTM4Yy0xLjg2NywyLjQzOC0zLjc0MSwzLjg4OC00LjcxMiwzLjc3MWgtMy41djMuNWgzLjVjMi4xODUtMC4wMjksMy44NzktMS4yNjYsNS4zNC0yLjY5M2MyLjE5NC0yLjE4NCw0LjExNi01LjE2Nyw2LjAwOS03LjUzOEMxOS4yMDUsMTIuMDAzLDIwLjc0NiwxMC42NzksMjEuNzg2LDEwLjM0MXonLz48L2c+PC9zdmc+';
var /*CONST String*/ REP1 = 'zInIGhlaWdodD0nMjQnPjxnPjxwYXRoIHN0eWxlPSdmaWxsOi';
var /*CONST String*/ REP2 = '7JyBkPSdNMjgsMTRjMCwxLjEwMi0wLjg5OCwyLTIsMkg3Ljk5MnYtNEwwLDE4bDcuOTkyLDZ2LTRIMjZjMy4zMDksMCw2LTIuNjk1LDYtNkgyOHonLz48cGF0aCBzdHlsZT0nZmlsbDoj';
var /*CONST String*/ REP3 = 'OycgZD0nTTYsOGgxOHY0bDgtNmwtOC02djRINmMtMy4zMDksMC02LDIuNjg4LTYsNmg0QzQsOC44OTgsNC44OTgsOCw2LDh6Jy8+PC9nPjwvc3ZnPg==';

var /*CONST String*/ ICON_CLOSE    = PRE + 'jgnIGhlaWdodD0nMjgnPjxnPjxwb2x5Z29uIHN0eWxlPSdmaWxsOiNjY2NjY2M7JyBwb2ludHM9JzI4LDIyLjM5OCAxOS41OTQsMTQgMjgsNS42MDIgMjIuMzk4LDAgMTQsOC40MDIgNS41OTgsMCAwLDUuNjAyIDguMzk4LDE0IDAsMjIuMzk4IDUuNTk4LDI4IDE0LDE5LjU5OCAyMi4zOTgsMjgnLz48L2c+PC9zdmc+';
var /*CONST String*/ ICON_DELAY    = PRE + 'zInIGhlaWdodD0nMzInPjxnPjxwYXRoIHN0eWxlPSdmaWxsOiNjY2NjY2M7JyBkPSdNMTYsNGM2LjYxNywwLDEyLDUuMzgzLDEyLDEycy01LjM4MywxMi0xMiwxMlM0LDIyLjYxNyw0LDE2UzkuMzgzLDQsMTYsNE0xNiwwQzcuMTY0LDAsMCw3LjE2NCwwLDE2czcuMTY0LDE2LDE2LDE2czE2LTcuMTY0LDE2LTE2UzI0LjgzNiwwLDE2LDBMMTYsMHonLz48cGF0aCBzdHlsZT0nZmlsbDojY2NjY2NjOycgZD0nTTIxLjQyMiwxOC41NzhMMTgsMTUuMTUyVjhoLTQuMDIzdjcuOTkyYzAsMC42MDIsMC4yNzcsMS4xMjEsMC42OTUsMS40OTJsMy45MjIsMy45MjJMMjEuNDIyLDE4LjU3OHonLz48L2c+PC9zdmc+';
var /*CONST String*/ ICON_NEXT     = PRE + 'zInIGhlaWdodD0nMzInPjxnPjxwYXRoIHN0eWxlPSdmaWxsOiNjY2NjY2M7JyBkPSdNMTYuMDE2LDBsLTUuNjY4LDUuNjcyYzAsMCwzLjE4LDMuMTgsNi4zMTIsNi4zMTJIMHY4LjAyN2gxNi42NmwtNi4zMTYsNi4zMTZMMTYuMDE2LDMyTDMyLDE2TDE2LjAxNiwweicvPjwvZz48L3N2Zz4=';
var /*CONST String*/ ICON_PAUSE    = PRE + 'jQnIGhlaWdodD0nMzInPjxnPjxyZWN0IHN0eWxlPSdmaWxsOiNjY2NjY2M7JyB3aWR0aD0nOCcgaGVpZ2h0PSczMicvPjxyZWN0IHN0eWxlPSdmaWxsOiNjY2NjY2M7JyB4PScxNicgd2lkdGg9JzgnIGhlaWdodD0nMzInLz48L2c+PC9zdmc+';
var /*CONST String*/ ICON_PLAY     = PRE + 'jQnIGhlaWdodD0nMzInPjxnPjxwb2x5Z29uIHN0eWxlPSdmaWxsOiNjY2NjY2M7JyBwb2ludHM9JzAsMCAyNCwxNiAwLDMyJy8+PC9nPjwvc3ZnPg==';
var /*CONST String*/ ICON_PREV     = PRE + 'zInIGhlaWdodD0nMzInPjxnPjxwYXRoIHN0eWxlPSdmaWxsOiNjY2NjY2M7JyBkPSdNMTUuOTg0LDMybDUuNjcyLTUuNjcyYzAsMC0zLjE4LTMuMTgtNi4zMTItNi4zMTJIMzJ2LTguMDIzSDE1LjM0NGw2LjMxMi02LjMyTDE1Ljk4NCwwTDAsMTZMMTUuOTg0LDMyeicvPjwvZz48L3N2Zz4=';
var /*CONST String*/ ICON_RANDOM   = PRE + RND1 + 'M2NjY2NjY' + RND2;
var /*CONST String*/ ICON_RANDOM_A = PRE + RND1 + 'NkZGRkZGQ' + RND2;
var /*CONST String*/ ICON_REPEAT   = PRE + REP1 + 'M2NjY2NjY' + REP2 + 'NjY2NjY2' + REP3;
var /*CONST String*/ ICON_REPEAT_A = PRE + REP1 + 'NkZGRkZGQ' + REP2 + 'ZGRkZGRk' + REP3;
var /*CONST String*/ ICON_SETTINGS = PRE + 'zInIGhlaWdodD0nMzInPjxnPjxwYXRoIHN0eWxlPSdmaWxsOiNjY2NjY2M7JyBkPSdNMzIsMTcuOTY5di00bC00Ljc4MS0xLjk5MmMtMC4xMzMtMC4zNzUtMC4yNzMtMC43MzgtMC40NDUtMS4wOTRsMS45My00LjgwNUwyNS44NzUsMy4yNWwtNC43NjIsMS45NjFjLTAuMzYzLTAuMTc2LTAuNzM0LTAuMzI0LTEuMTE3LTAuNDYxTDE3Ljk2OSwwaC00bC0xLjk3Nyw0LjczNGMtMC4zOTgsMC4xNDEtMC43ODEsMC4yODktMS4xNiwwLjQ2OWwtNC43NTQtMS45MUwzLjI1LDYuMTIxbDEuOTM4LDQuNzExQzUsMTEuMjE5LDQuODQ4LDExLjYxMyw0LjcwMywxMi4wMkwwLDE0LjAzMXY0bDQuNzA3LDEuOTYxYzAuMTQ1LDAuNDA2LDAuMzAxLDAuODAxLDAuNDg4LDEuMTg4bC0xLjkwMiw0Ljc0MmwyLjgyOCwyLjgyOGw0LjcyMy0xLjk0NWMwLjM3OSwwLjE4LDAuNzY2LDAuMzI0LDEuMTY0LDAuNDYxTDE0LjAzMSwzMmg0bDEuOTgtNC43NThjMC4zNzktMC4xNDEsMC43NTQtMC4yODksMS4xMTMtMC40NjFsNC43OTcsMS45MjJsMi44MjgtMi44MjhsLTEuOTY5LTQuNzczYzAuMTY4LTAuMzU5LDAuMzA1LTAuNzIzLDAuNDM4LTEuMDk0TDMyLDE3Ljk2OXpNMTUuOTY5LDIyYy0zLjMxMiwwLTYtMi42ODgtNi02czIuNjg4LTYsNi02czYsMi42ODgsNiw2UzE5LjI4MSwyMiwxNS45NjksMjJ6Jy8+PC9nPjwvc3ZnPg==';

/**
 * @type {String}
 * @const
 */
var SLIDESHOW_CSS = "\
.slideshow div, .slideshow p, .slideshow span, .slideshow h1, .slideshow hr, .slideshow a, .slideshow img, .slideshow label, .slideshow input, .slideshow input:focus{\n\
	background-color: transparent;\n\
	border-radius: 0;\n\
	border: 0;\n\
	box-shadow: none;\n\
	color: #fff;\n\
	font-size: 100%;\n\
	font: normal 11pt sans-serif;\n\
	margin: 0;\n\
	outline: 0;\n\
	padding: 0;\n\
	text-decoration: none;\n\
	transition: none;\n\
	vertical-align: baseline;\n\
}\n\
.slideshow input, .slideshow input:focus {\n\
	background-color: rgba(0, 0, 0, 0);\n\
	border: 1px solid #fff;\n\
	margin-bottom: 10px;\n\
	margin-right: 10px;\n\
	border-radius: 3px;\n\
}\n\
.slideshow input[type='number'] {width: 50px; height: 25px;}\n\
.slideshow input[type='number']:focus {border: 1px solid #08c;}\n\
.slideshow label {\n\
	display: block;\n\
}\n\
#slideshow hr {\n\
	background-color: white;\n\
	border: 0;\n\
	color: white;\n\
	height: 1px;\n\
}\n\
#slideshow #slideshow_settings hr {margin: 5px -10px;}\n\
#slideshow h1 {\n\
	display: table;\n\
	height: 25px;\n\
	letter-spacing: .3em;\n\
	text-align: center;\n\
	width: 100%;\n\
}\n\
#slideshow h1 span {\n\
	display: table-cell;\n\
	font-weight: bold;\n\
	vertical-align: middle;\n\
}\n\
#slideshow #slideshow_menu, #slideshow #slideshow_load, #slideshow #slideshow_screen {\n\
	position: fixed;\n\
	right: 0;\n\
	top: 0;\n\
	z-index: 999999;\n\
}\n\
#slideshow #slideshow_screen {\n\
	bottom: 0;\n\
	left:   0;\n\
}\n\
#slideshow .slideshow_icon {\n\
	background-color: transparent;\n\
	background-origin: content-box;\n\
	background-position: center center;\n\
	background-repeat: no-repeat;\n\
	background-size: contain;\n\
}\n\
#slideshow .slideshow_normal {height: 25px; width: 25px;}\n\
#slideshow .slideshow_small  {height: 15px; width: 15px;}\n\
#slideshow #slideshow_btn_random {left: 35px;}\n\
#slideshow #slideshow_btn_repeat {left: 60px;}\n\
#slideshow [unselectable='on'] {\n\
	cursor: default;\n\
	-webkit-touch-callout: none;\n\
	-webkit-user-select: none;\n\
	 -khtml-user-select: none;\n\
	   -moz-user-select: none;\n\
		-ms-user-select: none;\n\
		 -o-user-select: none;\n\
			user-select: none;\n\
}\n\
#slideshow #slideshow_img_container {\n\
	border-radius: 5px;\n\
	padding: 5px;\n\
	position: absolute;\n\
}\n\
#slideshow #slideshow_load {\n\
	border-radius: 5px;\n\
	padding: 5px;\n\
	position: fixed;\n\
	width: 200px;\n\
	height: 200px;\n\
	left: 50%; top: 50%;\n\
	margin-left: -100px;\n\
	margin-top: -100px;\n\
}\n\
#slideshow #slideshow_img_container img, #slideshow #slideshow_load img {\n\
	display: block;\n\
	height: 100%;\n\
	width: 100%;\n\
}\n\
#slideshow #slideshow_post {\n\
	bottom: 5px;\n\
	left: 5px;\n\
	max-height: 30%;\n\
	overflow: auto;\n\
	padding: 5px;\n\
	position: absolute;\n\
	right: 5px;\n\
}\n\
#slideshow #slideshow_post a {text-decoration: underline;}\n\
#slideshow #slideshow_post a:hover {color: #08c;}\n\
#slideshow a.slideshow_btn {\n\
	display: block;\n\
	padding: 5px;\n\
}\n\
#slideshow #slideshow_thumbs_container {\n\
	bottom: 0;\n\
	left: 0;\n\
	max-height: 170px;\n\
	overflow: hidden;\n\
	position: absolute;\n\
	right: 0;\n\
}\n\
#slideshow #slideshow_thumbs_scroll_left, #slideshow #slideshow_thumbs_scroll_right {\n\
	height: 100%;\n\
	position: fixed;\n\
	width: 5%;\n\
}\n\
#slideshow #slideshow_thumbs_scroll_left {\n\
	background: rgba(0,0,0,0.8);\n\
	background: -webkit-gradient(linear, left top, right top, from(rgba(0,0,0,0.8)), to(rgba(0,0,0,0))); /* Safari 4+, Chrome */\n\
	background: -webkit-linear-gradient(left, rgba(0,0,0,0.8), rgba(0,0,0,0)); /* Chrome 10+, Safari 5.1+, iOS 5+ */\n\
	background:    -moz-linear-gradient(left, rgba(0,0,0,0.8), rgba(0,0,0,0)); /* Firefox 3.6-15 */\n\
	background:      -o-linear-gradient(left, rgba(0,0,0,0.8), rgba(0,0,0,0)); /* Opera 11.10-12.00 */\n\
	background:         linear-gradient(to right, rgba(0,0,0,0.8), rgba(0,0,0,0)); /* Firefox 16+, IE10, Opera 12.50+ */\n\
	left: 0px;\n\
}\n\
#slideshow #slideshow_thumbs_scroll_left:hover {\n\
	background-color: rgba(255,255,255,0.5);\n\
	background: -webkit-gradient(linear, left top, right top, from(rgba(255,255,255,0.5)), to(rgba(255,255,255,0))); /* Safari 4+, Chrome */\n\
	background: -webkit-linear-gradient(left, rgba(255,255,255,0.5), rgba(255,255,255,0)); /* Chrome 10+, Safari 5.1+, iOS 5+ */\n\
	background:    -moz-linear-gradient(left, rgba(255,255,255,0.5), rgba(255,255,255,0)); /* Firefox 3.6-15 */\n\
	background:      -o-linear-gradient(left, rgba(255,255,255,0.5), rgba(255,255,255,0)); /* Opera 11.10-12.00 */\n\
	background:         linear-gradient(to right, rgba(255,255,255,0.5), rgba(255,255,255,0)); /* Firefox 16+, IE10, Opera 12.50+ */\n\
}\n\
#slideshow #slideshow_thumbs_scroll_left:active {\n\
	background-color: rgba(127,127,127,0.5);\n\
	background: -webkit-gradient(linear, left top, right top, from(rgba(127,127,127,0.5)), to(rgba(127,127,127,0))); /* Safari 4+, Chrome */\n\
	background: -webkit-linear-gradient(left, rgba(127,127,127,0.5), rgba(127,127,127,0)); /* Chrome 10+, Safari 5.1+, iOS 5+ */\n\
	background:    -moz-linear-gradient(left, rgba(127,127,127,0.5), rgba(127,127,127,0)); /* Firefox 3.6-15 */\n\
	background:      -o-linear-gradient(left, rgba(127,127,127,0.5), rgba(127,127,127,0)); /* Opera 11.10-12.00 */\n\
	background:         linear-gradient(to right, rgba(127,127,127,0.5), rgba(127,127,127,0)); /* Firefox 16+, IE10, Opera 12.50+ */\n\
}\n\
#slideshow #slideshow_thumbs_scroll_right {\n\
	background: rgba(0,0,0,0.8);\n\
	background: -webkit-gradient(linear, right top, left top, from(rgba(0,0,0,0.8)), to(rgba(0,0,0,0))); /* Safari 4+, Chrome */\n\
	background: -webkit-linear-gradient(right, rgba(0,0,0,0.8), rgba(0,0,0,0)); /* Chrome 10+, Safari 5.1+, iOS 5+ */\n\
	background:    -moz-linear-gradient(right, rgba(0,0,0,0.8), rgba(0,0,0,0)); /* Firefox 3.6-15 */\n\
	background:      -o-linear-gradient(right, rgba(0,0,0,0.8), rgba(0,0,0,0)); /* Opera 11.10-12.00 */\n\
	background:         linear-gradient(to left, rgba(0,0,0,0.8), rgba(0,0,0,0)); /* Firefox 16+, IE10, Opera 12.50+ */\n\
	right: 0px;\n\
}\n\
#slideshow #slideshow_thumbs_scroll_right:hover {\n\
	background-color: rgba(255,255,255,0.5);\n\
	background: -webkit-gradient(linear, right top, left top, from(rgba(255,255,255,0.5)), to(rgba(255,255,255,0))); /* Safari 4+, Chrome */\n\
	background: -webkit-linear-gradient(right, rgba(255,255,255,0.5), rgba(255,255,255,0)); /* Chrome 10+, Safari 5.1+, iOS 5+ */\n\
	background:    -moz-linear-gradient(right, rgba(255,255,255,0.5), rgba(255,255,255,0)); /* Firefox 3.6-15 */\n\
	background:      -o-linear-gradient(right, rgba(255,255,255,0.5), rgba(255,255,255,0)); /* Opera 11.10-12.00 */\n\
	background:         linear-gradient(to left, rgba(255,255,255,0.5), rgba(255,255,255,0)); /* Firefox 16+, IE10, Opera 12.50+ */\n\
}\n\
#slideshow #slideshow_thumbs_scroll_right:active {\n\
	background-color: rgba(127,127,127,0.5);\n\
	background: -webkit-gradient(linear, right top, left top, from(rgba(127,127,127,0.5)), to(rgba(127,127,127,0))); /* Safari 4+, Chrome */\n\
	background: -webkit-linear-gradient(right, rgba(127,127,127,0.5), rgba(127,127,127,0)); /* Chrome 10+, Safari 5.1+, iOS 5+ */\n\
	background:    -moz-linear-gradient(right, rgba(127,127,127,0.5), rgba(127,127,127,0)); /* Firefox 3.6-15 */\n\
	background:      -o-linear-gradient(right, rgba(127,127,127,0.5), rgba(127,127,127,0)); /* Opera 11.10-12.00 */\n\
	background:         linear-gradient(to left, rgba(127,127,127,0.5), rgba(127,127,127,0)); /* Firefox 16+, IE10, Opera 12.50+ */\n\
}\n\
#slideshow #slideshow_settings {\n\
	padding: 10px;\n\
	left: 50px;\n\
	border-bottom-left-radius: 5px;\n\
	border-bottom-right-radius: 5px;\n\
}\n\
#slideshow #slideshow_thumbs {\n\
	text-align: center;\n\
	white-space: nowrap;\n\
}\n\
#slideshow #slideshow_thumbs a {\n\
	border-radius: 5px;\n\
	border: 1px solid transparent;\n\
	display: inline-block;\n\
	float: none;\n\
	line-height: 0;\n\
	margin: 4px 6px;\n\
	padding: 5px;\n\
	vertical-align: middle;\n\
}\n\
#slideshow #slideshow_thumbs .slideshow_thumb_current {\n\
	border-color: white;\n\
}\n\
#slideshow #slideshow_thumbs .slideshow_thumb_number {\n\
	display: table;\n\
	width: 160px;\n\
	height: 140px;\n\
	text-align: center;\n\
}\n\
#slideshow #slideshow_thumbs .slideshow_thumb_number span {\n\
	display: table-cell;\n\
	font-size: 5em;\n\
	vertical-align: middle;\n\
}\n\
#slideshow #slideshow_thumbs img {max-height: 150px;}\n\
#slideshow #slideshow_btn_prev, #slideshow #slideshow_btn_play,  #slideshow #slideshow_btn_repeat {border-top-right-radius: 5px;}\n\
#slideshow #slideshow_btn_next, #slideshow #slideshow_btn_start, #slideshow #slideshow_btn_close  {border-bottom-left-radius: 5px;}\n\
#slideshow #slideshow_btn_prev, #slideshow #slideshow_btn_settings {border-bottom-right-radius: 5px;}\n\
#slideshow #slideshow_btn_next, #slideshow #slideshow_btn_thumbs   {border-top-left-radius: 5px;}\n\
#slideshow .slideshow_top    {position: absolute; top:    0px;}\n\
#slideshow .slideshow_bottom {position: absolute; bottom: 0px;}\n\
#slideshow .slideshow_left   {position: absolute; left:   0px;}\n\
#slideshow .slideshow_right  {position: absolute; right:  0px;}\n\
#slideshow .slideshow_middle {position: absolute; top:  50%; margin-top:  -17.5px;}\n\
#slideshow .slideshow_black, #slideshow a.slideshow_btn,        #slideshow a.slideshow_thumb        {background-color: rgba(0,0,0,0.8);}\n\
                             #slideshow a.slideshow_btn:hover,  #slideshow a.slideshow_thumb:hover  {background-color: rgba(255,255,255,0.5);}\n\
                             #slideshow a.slideshow_btn:active, #slideshow a.slideshow_thumb:active {background-color: rgba(127,127,127,0.5);}\n\
#slideshow .slideshow_icon_close    {background-image: url('" + ICON_CLOSE    + "');}\n\
#slideshow .slideshow_icon_delay    {background-image: url('" + ICON_DELAY    + "');}\n\
#slideshow .slideshow_icon_next     {background-image: url('" + ICON_NEXT     + "');}\n\
#slideshow .slideshow_icon_pause    {background-image: url('" + ICON_PAUSE    + "');}\n\
#slideshow .slideshow_icon_play     {background-image: url('" + ICON_PLAY     + "');}\n\
#slideshow .slideshow_icon_prev     {background-image: url('" + ICON_PREV     + "');}\n\
#slideshow .slideshow_icon_random   {background-image: url('" + ICON_RANDOM   + "');}\n\
#slideshow .slideshow_icon_random_a {background-image: url('" + ICON_RANDOM_A + "');}\n\
#slideshow .slideshow_icon_repeat   {background-image: url('" + ICON_REPEAT   + "');}\n\
#slideshow .slideshow_icon_repeat_a {background-image: url('" + ICON_REPEAT_A + "');}\n\
#slideshow .slideshow_icon_settings {background-image: url('" + ICON_SETTINGS + "');}\n\
";

/*==============================================================================
									HTML
==============================================================================*/

var SLIDESHOW_HTML = "\
<div id='slideshow_menu'>\n\
	<a id='slideshow_btn_start' class='slideshow_btn'><div class='slideshow_icon slideshow_icon_play slideshow_normal'></div></a>\n\
</div>\n\
<div id='slideshow_load' class='slideshow_black' style='display: none;'>\n\
	<img src='" + ICON_DELAY + "'/>\n\
</div>\n\
<div id='slideshow_screen' class='slideshow_black' style='display: none;'>\n\
	<div id='slideshow_content'>\n\
		<div id='slideshow_img_container' class='slideshow_black'>\n\
			<img id='slideshow_img'>\n\
			<div id='slideshow_post' class='slideshow_black'></div>\n\
		</div>\n\
	</div>\n\
	<div id='slideshow_controls'>\n\
		<div id='slideshow_settings' class='slideshow_black slideshow_left slideshow_top' style='display: none;'>\n\
			<h1><span>SETTINGS</span></h1>\n\
			<hr />\n\
			<div>\n\
				<label title=''><input type='checkbox' id='slideshow_settings_b_defaultPlay'      />Play on start</label>\n\
				<label title=''><input type='checkbox' id='slideshow_settings_b_useHistory'       />Use history</label>\n\
				<label title=''><input type='checkbox' id='slideshow_settings_b_keepNexthistory'  />Keep next history</label>\n\
				<label title=''><input type='checkbox' id='slideshow_settings_b_overlayThumbs'    />Overlay thumbs</label>\n\
				<label title=''><input type='checkbox' id='slideshow_settings_b_pinPost'          />Pin post</label>\n\
				<label title='Delay in seconds, 0 = Never hide'>\n\
					<input type='number' min='0' max='999' id='slideshow_settings_i_controlsHideDelay'/>Controls hide delay</label>\n\
				<label title='0 = Keep all'>\n\
					<input type='number' min='0' max='999' id='slideshow_settings_i_maxHistoryLength' />Max history length</label>\n\
				<label title='Delay in seconds'>\n\
					<input type='number' min='0.5' max='999' id='slideshow_settings_i_slidesChangeDelay'/>Slides change delay</label>\n\
			</div>\n\
			<hr />\n\
			<div>\n\
				<b>Toggle zoom</b>: Double click on image<br />\n\
				<b>Zoom in/out</b>: Mouse wheel<br />\n\
				<b>Play/pause</b>: Space bar<br />\n\
				<b>Prev image</b>: Z, ←, ↓<br />\n\
				<b>Next image</b>: X, →, ↑<br />\n\
				<b>Quit</b>: Q, Escape\n\
			</div>\n\
		</div>\n\
		<div id='slideshow_thumbs_container' class='slideshow_black' unselectable='on' style='display: none;'>\n\
			<div id='slideshow_thumbs_scroll_left'></div>\n\
			<div id='slideshow_thumbs_scroll_right'></div>\n\
			<div id='slideshow_thumbs' unselectable='on'></div>\n\
		</div>\n\
		<a class='slideshow_btn slideshow_top    slideshow_right' unselectable='on' id='slideshow_btn_close'   ><div class='slideshow_icon slideshow_normal slideshow_icon_close'   ></div></a>\n\
		<a class='slideshow_btn slideshow_top    slideshow_left'  unselectable='on' id='slideshow_btn_settings'><div class='slideshow_icon slideshow_normal slideshow_icon_settings'></div></a>\n\
		<a class='slideshow_btn slideshow_middle slideshow_right' unselectable='on' id='slideshow_btn_next'    ><div class='slideshow_icon slideshow_normal slideshow_icon_next'    ></div></a>\n\
		<a class='slideshow_btn slideshow_middle slideshow_left'  unselectable='on' id='slideshow_btn_prev'    ><div class='slideshow_icon slideshow_normal slideshow_icon_prev'    ></div></a>\n\
		<a class='slideshow_btn slideshow_bottom'                 unselectable='on' id='slideshow_btn_random'  ><div class='slideshow_icon slideshow_small  slideshow_icon_random'  ></div></a>\n\
		<a class='slideshow_btn slideshow_bottom'                 unselectable='on' id='slideshow_btn_repeat'  ><div class='slideshow_icon slideshow_small  slideshow_icon_repeat'  ></div></a>\n\
		<a class='slideshow_btn slideshow_bottom slideshow_left'  unselectable='on' id='slideshow_btn_play'    ><div class='slideshow_icon slideshow_normal slideshow_icon_play'    ></div></a>\n\
		<a class='slideshow_btn slideshow_bottom slideshow_right' unselectable='on' id='slideshow_btn_thumbs'></a>\n\
	</div>\n\
</div>\n\
";

function testSite() {
	var site = w.location.href.toLowerCase();
	var i, j;
	for(i = 0; i < PROFILES.length; i++) {
		var currentProfile = PROFILES[i];
		var result = currentProfile.test();
		if(result === 1) {
			profile = currentProfile;
			main();
			return;
		} else if(result === -1) {
			return;
		}
	}
}

testSite();

})(window);
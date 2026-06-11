(function () {
	"use strict";

	var MIN_SCALE = 1;
	var MAX_SCALE = 4;
	var ZOOM_STEP = 0.25;

	var lightbox = null;
	var backdrop = null;
	var dialog = null;
	var viewport = null;
	var image = null;
	var zoomLabel = null;
	var btnZoomIn = null;
	var btnZoomOut = null;
	var btnReset = null;
	var btnClose = null;

	var scale = 1;
	var translateX = 0;
	var translateY = 0;
	var isDragging = false;
	var dragStartX = 0;
	var dragStartY = 0;
	var dragOriginX = 0;
	var dragOriginY = 0;
	var lastTouchDistance = 0;
	var previousBodyOverflow = "";
	var lastFocusedElement = null;

	function clamp(value, min, max) {
		return Math.min(max, Math.max(min, value));
	}

	function createLightbox() {
		if (lightbox) {
			return;
		}

		lightbox = document.createElement("div");
		lightbox.id = "image-lightbox";
		lightbox.className = "image-lightbox";
		lightbox.hidden = true;
		lightbox.setAttribute("aria-hidden", "true");
		lightbox.innerHTML =
			'<div class="image-lightbox__backdrop"></div>' +
			'<div class="image-lightbox__dialog" role="dialog" aria-modal="true" aria-label="Image preview">' +
				'<div class="image-lightbox__toolbar">' +
					'<button type="button" class="image-lightbox__btn" data-action="zoom-out" aria-label="Zoom out">&#8722;</button>' +
					'<span class="image-lightbox__zoom-level">100%</span>' +
					'<button type="button" class="image-lightbox__btn" data-action="zoom-in" aria-label="Zoom in">&#43;</button>' +
					'<button type="button" class="image-lightbox__btn image-lightbox__btn--text" data-action="reset">Reset</button>' +
					'<button type="button" class="image-lightbox__btn image-lightbox__btn--close" data-action="close" aria-label="Close preview">&#10005;</button>' +
				"</div>" +
				'<div class="image-lightbox__viewport">' +
					'<img class="image-lightbox__image" alt="" draggable="false" />' +
				"</div>" +
				'<p class="image-lightbox__hint">Scroll or pinch to zoom. Drag to pan when zoomed in.</p>' +
			"</div>";

		document.body.appendChild(lightbox);

		backdrop = lightbox.querySelector(".image-lightbox__backdrop");
		dialog = lightbox.querySelector(".image-lightbox__dialog");
		viewport = lightbox.querySelector(".image-lightbox__viewport");
		image = lightbox.querySelector(".image-lightbox__image");
		zoomLabel = lightbox.querySelector(".image-lightbox__zoom-level");
		btnZoomIn = lightbox.querySelector("[data-action='zoom-in']");
		btnZoomOut = lightbox.querySelector("[data-action='zoom-out']");
		btnReset = lightbox.querySelector("[data-action='reset']");
		btnClose = lightbox.querySelector("[data-action='close']");

		btnClose.addEventListener("click", closeLightbox);
		backdrop.addEventListener("click", closeLightbox);
		btnZoomIn.addEventListener("click", function () {
			setScale(scale + ZOOM_STEP);
		});
		btnZoomOut.addEventListener("click", function () {
			setScale(scale - ZOOM_STEP);
		});
		btnReset.addEventListener("click", resetView);

		viewport.addEventListener("wheel", function (event) {
			event.preventDefault();
			var delta = event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
			setScale(scale + delta, event.clientX, event.clientY);
		}, { passive: false });

		viewport.addEventListener("pointerdown", function (event) {
			if (scale <= 1 || event.button !== 0) {
				return;
			}
			isDragging = true;
			dragStartX = event.clientX;
			dragStartY = event.clientY;
			dragOriginX = translateX;
			dragOriginY = translateY;
			viewport.setPointerCapture(event.pointerId);
			viewport.classList.add("is-dragging");
		});

		viewport.addEventListener("pointermove", function (event) {
			if (!isDragging) {
				return;
			}
			translateX = dragOriginX + (event.clientX - dragStartX);
			translateY = dragOriginY + (event.clientY - dragStartY);
			updateTransform();
		});

		viewport.addEventListener("pointerup", endDrag);
		viewport.addEventListener("pointercancel", endDrag);

		viewport.addEventListener("touchstart", function (event) {
			if (event.touches.length === 2) {
				lastTouchDistance = getTouchDistance(event.touches);
			}
		}, { passive: true });

		viewport.addEventListener("touchmove", function (event) {
			if (event.touches.length !== 2) {
				return;
			}
			event.preventDefault();
			var distance = getTouchDistance(event.touches);
			if (lastTouchDistance > 0) {
				var midpointX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
				var midpointY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
				var pinchDelta = (distance - lastTouchDistance) * 0.01;
				setScale(scale + pinchDelta, midpointX, midpointY);
			}
			lastTouchDistance = distance;
		}, { passive: false });

		viewport.addEventListener("touchend", function () {
			lastTouchDistance = 0;
		});

		dialog.addEventListener("click", function (event) {
			event.stopPropagation();
		});

		document.addEventListener("keydown", function (event) {
			if (!lightbox || lightbox.hidden) {
				return;
			}
			if (event.key === "Escape") {
				closeLightbox();
			}
			if (event.key === "+" || event.key === "=") {
				setScale(scale + ZOOM_STEP);
			}
			if (event.key === "-") {
				setScale(scale - ZOOM_STEP);
			}
			if (event.key === "0") {
				resetView();
			}
		});
	}

	function updateTransform() {
		image.style.transform = "translate(" + translateX + "px, " + translateY + "px) scale(" + scale + ")";
		zoomLabel.textContent = Math.round(scale * 100) + "%";
		viewport.classList.toggle("is-zoomed", scale > 1.01);
	}

	function resetView() {
		scale = 1;
		translateX = 0;
		translateY = 0;
		updateTransform();
	}

	function setScale(nextScale, originX, originY) {
		var previousScale = scale;
		scale = clamp(nextScale, MIN_SCALE, MAX_SCALE);

		if (originX !== undefined && originY !== undefined && previousScale !== scale) {
			var rect = viewport.getBoundingClientRect();
			var offsetX = originX - rect.left - rect.width / 2;
			var offsetY = originY - rect.top - rect.height / 2;
			var scaleRatio = scale / previousScale;
			translateX = (translateX - offsetX) * scaleRatio + offsetX;
			translateY = (translateY - offsetY) * scaleRatio + offsetY;
		}

		if (scale <= 1) {
			translateX = 0;
			translateY = 0;
		}

		updateTransform();
	}

	function getTouchDistance(touches) {
		var dx = touches[0].clientX - touches[1].clientX;
		var dy = touches[0].clientY - touches[1].clientY;
		return Math.sqrt(dx * dx + dy * dy);
	}

	function endDrag(event) {
		if (!isDragging) {
			return;
		}
		isDragging = false;
		viewport.classList.remove("is-dragging");
		if (event.pointerId !== undefined) {
			try {
				viewport.releasePointerCapture(event.pointerId);
			} catch (error) {
				// Pointer may already be released.
			}
		}
	}

	function getFullSrc(trigger) {
		var fullSrc = trigger.getAttribute("data-lightbox-full") || trigger.getAttribute("data-lightbox-src");
		if (fullSrc) {
			return fullSrc;
		}
		if (trigger.tagName === "IMG") {
			return trigger.getAttribute("src");
		}
		var nestedImage = trigger.querySelector("img");
		return nestedImage ? nestedImage.getAttribute("src") : "";
	}

	function getAltText(trigger) {
		if (trigger.tagName === "IMG") {
			return trigger.getAttribute("alt") || "Image preview";
		}
		var nestedImage = trigger.querySelector("img");
		return nestedImage ? nestedImage.getAttribute("alt") || "Image preview" : "Image preview";
	}

	function openLightbox(trigger) {
		createLightbox();

		var fullSrc = getFullSrc(trigger);
		if (!fullSrc) {
			return;
		}

		lastFocusedElement = trigger;
		image.setAttribute("src", fullSrc);
		image.setAttribute("alt", getAltText(trigger));

		resetView();
		lightbox.hidden = false;
		lightbox.setAttribute("aria-hidden", "false");
		previousBodyOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		btnClose.focus();
	}

	function closeLightbox() {
		if (!lightbox) {
			return;
		}
		lightbox.hidden = true;
		lightbox.setAttribute("aria-hidden", "true");
		document.body.style.overflow = previousBodyOverflow;
		if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
			lastFocusedElement.focus();
		}
		resetView();
	}

	function bindTrigger(trigger) {
		if (trigger.tagName === "BUTTON") {
			trigger.setAttribute("type", trigger.getAttribute("type") || "button");
		}

		if (trigger.tagName === "IMG") {
			trigger.setAttribute("tabindex", "0");
			trigger.setAttribute("role", "button");
		}

		trigger.addEventListener("click", function (event) {
			event.preventDefault();
			openLightbox(trigger);
		});

		trigger.addEventListener("keydown", function (event) {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				openLightbox(trigger);
			}
		});
	}

	function init() {
		var triggers = document.querySelectorAll("[data-lightbox]");
		if (!triggers.length) {
			return;
		}
		triggers.forEach(bindTrigger);
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();

// -----------------------------------------------------------------------------
// Drag and drop
// -----------------------------------------------------------------------------

const dropbox = document.getElementById("dropbox");

dropbox.addEventListener("dragenter", preventDragDefaults);
dropbox.addEventListener("dragover", preventDragDefaults);
dropbox.addEventListener("drop", drop);

function preventDragDefaults(event) {
    event.preventDefault();
    event.stopPropagation();
}

function drop(event) {
    event.preventDefault();
    event.stopPropagation();

    const files = event.dataTransfer.files;
    handleFile(files);
}


// -----------------------------------------------------------------------------
// DOM elements
// -----------------------------------------------------------------------------

const canvas = document.getElementById("preview");
const ctx = canvas.getContext("2d");

const rawCanvas = document.getElementById("raw");

const inputElement = document.getElementById("image-input");
const imageForm = document.getElementById("edit-form");

const widthInput = document.getElementById("width-input");
const heightInput = document.getElementById("height-input");
const ppiInput = document.getElementById("ppi");

const contrastSlider = document.getElementById("contrast-slider");
const thresholdSlider = document.getElementById("threshold-slider");
const angleSlider = document.getElementById("angle-slider");
const invertCheckbox = document.getElementById("invert-checkbox");

contrastSlider.addEventListener("input", function () {
  const value = Number(contrastSlider.value);
  contrastValue.value = value > 0 ? `+${value}` : String(value);
});

const addBorderCheckbox =
    document.getElementById("border-checkbox");

const invertBorderCheckbox =
    document.getElementById("invert-border-checkbox");

const submitFormButton =
    document.getElementById("submit-edit-form");

const halftoneTab =
    document.querySelector(
        'button[data-bs-target="#halftone-tab-pane"]'
    );

const thresholdTab =
    document.querySelector(
        'button[data-bs-target="#threshold-tab-pane"]'
    );


// -----------------------------------------------------------------------------
// Application state
// -----------------------------------------------------------------------------

let img = null;
let aspectRatio = null;
let mode = "halftone";

// -----------------------------------------------------------------------------
// Disabled Checkbox
// -----------------------------------------------------------------------------

addBorderCheckbox.addEventListener('change', () => {
	if (!addBorderCheckbox.checked) {
		invertBorderCheckbox.checked = false;
		invertBorderCheckbox.disabled = true;
	} else {
		invertBorderCheckbox.disabled = false;
	}
});

// constrain the preview size
function constrainPreviewSize(targetCanvas) {
  const maxSize = 400;
  const aspectRatio =
    targetCanvas.width / targetCanvas.height;

  let displayWidth;
  let displayHeight;

  if (aspectRatio >= 1) {
    displayWidth = maxSize;
    displayHeight = maxSize / aspectRatio;
  } else {
    displayHeight = maxSize;
    displayWidth = maxSize * aspectRatio;
  }

  targetCanvas.style.width =
    `min(${displayWidth}px, 100%)`;
  targetCanvas.style.height = "auto";
}



// -----------------------------------------------------------------------------
// Image loading
// -----------------------------------------------------------------------------

inputElement.addEventListener("change", handleFile);
const acceptedImageTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/avif"
]);

function handleFile(fileOrEvent) {
    const file = fileOrEvent.target
        ? fileOrEvent.target.files[0]
        : fileOrEvent[0];

    if (!file) {
        return;
    }

    if (!acceptedImageTypes.has(file.type)) {
	alert("Please select a PNG, JPEG, WebP, GIF, BMP, or AVIF image.");
	inputElement.value = "";
	return;
    }

    const reader = new FileReader();

    reader.onload = function (event) {
        img = new Image();


	img.onerror = function () {
  		alert("The browser could not decode this image.");
  	img = null;
	};

        img.onload = function () {
            aspectRatio =
                img.naturalHeight / img.naturalWidth;

            imageForm.style.display = "block";

            // Calculate the initial physical height.
            updatePhysicalDimensions();

            // Set the internal pixel dimensions.
            resizeCanvasToOutput();

            // Process the edited image.
            processImagePipeline();

            // Draw the original image in the raw preview canvas.
            drawRawPreview();
        };

        img.src = event.target.result;
    };

    reader.readAsDataURL(file);
}

function drawRawPreview() {
    const rawCtx = rawCanvas.getContext("2d");

    rawCanvas.width = 800;
    rawCanvas.height = Math.round(800 * aspectRatio);

    constrainPreviewSize(rawCanvas);
    rawCtx.clearRect(
        0,
        0,
        rawCanvas.width,
        rawCanvas.height
    );

    drawImageScaled(img, rawCtx, "contain");
}


// -----------------------------------------------------------------------------
// Physical size and output resolution
// -----------------------------------------------------------------------------

function updatePhysicalDimensions() {
    const widthInches = Number(widthInput.value);

    if (
        !Number.isFinite(widthInches) ||
        widthInches <= 0 ||
        !aspectRatio
    ) {
        return false;
    }

    const heightInches = widthInches * aspectRatio;

    heightInput.value = heightInches.toFixed(2);

    return true;
}

function resizeCanvasToOutput() {
    const widthInches = Number(widthInput.value);
    const outputPpi = Number(ppiInput.value);

    if (
        !Number.isFinite(widthInches) ||
        widthInches <= 0
    ) {
        return false;
    }

    if (
        !Number.isFinite(outputPpi) ||
        outputPpi <= 0 ||
	outputPpi > 1200
    ) {
        return false;
    }

    if (!aspectRatio) {
        return false;
    }

    const heightInches = widthInches * aspectRatio;

    // Internal resolution.
    canvas.width = Math.round(widthInches * outputPpi);
    canvas.height = Math.round(heightInches * outputPpi);

    // Display resolution.
    constrainPreviewSize(canvas);

    return true;
}


// -----------------------------------------------------------------------------
// Form input handling
// -----------------------------------------------------------------------------

imageForm.addEventListener("input", function (event) {
    if (!img) {
        return;
    }

    if (event.target === widthInput) {
        const dimensionsUpdated =
            updatePhysicalDimensions();

        if (!dimensionsUpdated) {
            return;
        }

        const canvasResized =
            resizeCanvasToOutput();

        if (!canvasResized) {
            return;
        }
    }

    if (event.target === ppiInput) {
        const canvasResized =
            resizeCanvasToOutput();

        if (!canvasResized) {
            return;
        }
    }

    processImagePipeline();
});


// -----------------------------------------------------------------------------
// Tabs and mode
// -----------------------------------------------------------------------------

halftoneTab.addEventListener("shown.bs.tab", function () {
    mode = "halftone";
    processImagePipeline();
});

thresholdTab.addEventListener("shown.bs.tab", function () {
    mode = "threshold";
    processImagePipeline();
});


// -----------------------------------------------------------------------------
// Main image-processing pipeline
// -----------------------------------------------------------------------------

function processImagePipeline() {
    if (!img) {
        return;
    }

    // Start from white so transparent pixels are treated as a white
    // background, the same way the original image preview shows them.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    drawImageScaled(img, ctx, "contain");

    adjustContrast(
        Number(contrastSlider.value)
    );

    convertToGrayscale();

    if (mode === "halftone") {
        adjustLevels(20, 220, 1.0);

        const selectedLpi =
            document.querySelector(
                'input[name="lpi"]:checked'
            );

        if (!selectedLpi) {
            console.error("No LPI option is selected.");
            return;
        }

        applyHalftone(
            canvas.width,
            canvas.height,
            Number(selectedLpi.value),
            Number(angleSlider.value),
            invertCheckbox.checked
        );
    }

    if (mode === "threshold") {
        applyThreshold(
            Number(thresholdSlider.value),
            invertCheckbox.checked
        );
    }
}


// -----------------------------------------------------------------------------
// Image processing functions
// -----------------------------------------------------------------------------

function adjustLevels(shadowInput, highlightInput, gamma) {
    const imageData = ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
    );

    const pixels = imageData.data;
    const lookupTable = new Uint8ClampedArray(256);

    for (let i = 0; i < 256; i++) {
        let value =
            (i - shadowInput) /
            (highlightInput - shadowInput);

        value = Math.max(0, Math.min(1, value));
        value = Math.pow(value, 1 / gamma);

        lookupTable[i] = Math.round(value * 255);
    }

    for (let i = 0; i < pixels.length; i += 4) {
        pixels[i] = lookupTable[pixels[i]];
        pixels[i + 1] = lookupTable[pixels[i + 1]];
        pixels[i + 2] = lookupTable[pixels[i + 2]];
    }

    ctx.putImageData(imageData, 0, 0);
}

function applyHalftone(width, height, lpi, angle, invert) {
    const imageData = ctx.getImageData(
        0,
        0,
        width,
        height
    );

    const pixels = imageData.data;

    const outputPpi = Number(ppiInput.value);
    const spacing = Math.max(1.5, outputPpi / lpi);

    const radians = angle * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    const maxDimension =
        Math.sqrt(width * width + height * height);

    // White dots are kept and the black background is sandblasted, so
    // dark areas (big dots) are kept, matching threshold mode.
    ctx.fillStyle = invert ? "#ffffff" : "#000000";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = invert ? "#000000" : "#ffffff";

    for (
        let u = -maxDimension;
        u < maxDimension;
        u += spacing
    ) {
        for (
            let v = -maxDimension;
            v < maxDimension;
            v += spacing
        ) {
            const x = Math.floor(
                u * cos - v * sin + width / 2
            );

            const y = Math.floor(
                u * sin + v * cos + height / 2
            );

            if (
                x < 0 ||
                x >= width ||
                y < 0 ||
                y >= height
            ) {
                continue;
            }

            const index = (y * width + x) * 4;

            const r = pixels[index];
            const g = pixels[index + 1];
            const b = pixels[index + 2];

            const brightness =
                0.299 * r +
                0.587 * g +
                0.114 * b;

            const darkness =
                (255 - brightness) / 255;

            const maxRadius = spacing * 0.68;
            const radius =
                maxRadius * Math.sqrt(darkness);

            if (radius <= 0.1) {
                continue;
            }

            ctx.beginPath();
            ctx.arc(
                x,
                y,
                radius,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }
    }
}

function adjustContrast(contrastValue) {
    const imageData = ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
    );

    const data = imageData.data;

    const factor =
        (259 * (contrastValue + 255)) /
        (255 * (259 - contrastValue));

    for (let i = 0; i < data.length; i += 4) {
        data[i] =
            factor * (data[i] - 128) + 128;

        data[i + 1] =
            factor * (data[i + 1] - 128) + 128;

        data[i + 2] =
            factor * (data[i + 2] - 128) + 128;
    }

    ctx.putImageData(imageData, 0, 0);
}

function convertToGrayscale() {
    const imageData = ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
    );

    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const value =
            0.2126 * r +
            0.7152 * g +
            0.0722 * b;

        data[i] = value;
        data[i + 1] = value;
        data[i + 2] = value;
    }

    ctx.putImageData(imageData, 0, 0);
}

function applyThreshold(threshold, invert) {
    const imageData = ctx.getImageData(
        0,
        0,
        canvas.width,
        canvas.height
    );

    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        const value = invert
            ? data[i]
            : 255 - data[i];

        const finalColor =
            value >= threshold ? 255 : 0;

        data[i] = finalColor;
        data[i + 1] = finalColor;
        data[i + 2] = finalColor;
    }

    ctx.putImageData(imageData, 0, 0);
}


// -----------------------------------------------------------------------------
// Drawing
// -----------------------------------------------------------------------------

function drawImageScaled(image, context, mode = "contain") {
    const canvasWidth = context.canvas.width;
    const canvasHeight = context.canvas.height;

    const horizontalRatio =
        canvasWidth / image.width;

    const verticalRatio =
        canvasHeight / image.height;

    const ratio = mode === "contain"
        ? Math.min(horizontalRatio, verticalRatio)
        : Math.max(horizontalRatio, verticalRatio);

    const offsetX =
        (canvasWidth - image.width * ratio) / 2;

    const offsetY =
        (canvasHeight - image.height * ratio) / 2;

    context.drawImage(
        image,
        0,
        0,
        image.width,
        image.height,
        offsetX,
        offsetY,
        image.width * ratio,
        image.height * ratio
    );
}


// -----------------------------------------------------------------------------
// PDF download
// -----------------------------------------------------------------------------

submitFormButton.addEventListener("click", function () {
    if (!img) {
        return;
    }

    processImagePipeline();
    downloadImage();
});

function downloadImage() {
    const { jsPDF } = window.jspdf;

    const imageWidth = Number(widthInput.value);
    const imageHeight = Number(heightInput.value);

    const margin = addBorderCheckbox.checked
        ? 0.125
        : 0;

    const pdf = new jsPDF({
        orientation: imageHeight >= imageWidth
            ? "portrait"
            : "landscape",
        unit: "in",
        format: [
            8.5,
            11
        ]
    });

    // Black gets sandblasted, so the border is only black when it should
    // be blasted into the piece. Otherwise the white page is the border.
    if (
        addBorderCheckbox.checked &&
        invertBorderCheckbox.checked
    ) {
        pdf.setFillColor(0, 0, 0);

        pdf.rect(
            0,
            0,
            imageWidth + margin * 2,
            imageHeight + margin * 2,
            "F"
        );
    }

    const canvasImageData =
        canvas.toDataURL("image/png");

    // Without compression jsPDF stores the raw pixels (~26 MB at 600 PPI).
    pdf.addImage(
        canvasImageData,
        "PNG",
        margin,
        margin,
        imageWidth,
        imageHeight,
        undefined,
        "FAST"
    );

    pdf.save("rapidmask-image.pdf");
}

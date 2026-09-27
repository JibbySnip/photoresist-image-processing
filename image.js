
// set up drag and drop
let dropbox;

dropbox = document.getElementById("dropbox");
dropbox.addEventListener("dragenter", dragenter);
dropbox.addEventListener("dragover", dragover);
dropbox.addEventListener("drop", drop);

function dragenter(e) {
  e.stopPropagation();
  e.preventDefault();
}

function dragover(e) {
  e.stopPropagation();
  e.preventDefault();
}

function drop(e) {
  e.stopPropagation();
  e.preventDefault();

  const dt = e.dataTransfer;
  const files = dt.files;

  handleFile(files);
}

// setup the canvas and all
const canvas = document.getElementById("preview");
const ctx = canvas.getContext("2d");

const rawCanvas = document.getElementById("raw");

const inputElement = document.getElementById("image-input");
const imageForm = document.getElementById("edit-form");

const widthInput = document.getElementById("width-input");
const heightInput = document.getElementById("height-input");
const ppiInput = document.getElementById("ppi");

let img = null;
let aspectRatio = null;

// show the makeBorderWhite button if addBorder is checked
const addBorder = document.getElementById("border-checkbox");
const makeBorderWhite = document.getElementById("invert-border-checkbox");

addBorder.addEventListener('click', () => {
	if (addBorder.checked) {
		makeBorderWhite.checked = false;
		makeBorderWhite.style.display = "block";
	} else {
		makeBorderWhite.style.display = "none";
	}

});


// set up image submission that triggers display on canvas and showing the image editing menu
inputElement.addEventListener("change", handleFile, false);

async function handleFile(fileOrEvent) {
    const file = fileOrEvent.target
        ? fileOrEvent.target.files[0]
        : fileOrEvent[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = function(event) {
        img = new Image();

        img.onload = function() {
            // Store the original image aspect ratio
            aspectRatio = img.naturalHeight / img.naturalWidth;

            // Show the editing controls
            imageForm.style.display = "block";

            // Set the initial physical height from the chosen width
            updatePhysicalDimensions();

            // Set the internal pixel dimensions
            resizeCanvasToOutput();

            // Process the image
            processImagePipeline();

            // Optional raw/original preview
            const rawCtx = rawCanvas.getContext("2d");

            rawCanvas.width = 800;
            rawCanvas.height = Math.round(
                800 * aspectRatio
            );

            rawCtx.clearRect(
                0,
                0,
                rawCanvas.width,
                rawCanvas.height
            );

            drawImageScaled(img, rawCtx, "contain");
        };

        img.src = event.target.result;
    };

    reader.readAsDataURL(file);
}

function updatePhysicalDimensions() {
    const widthInches = Number(widthInput.value);

    if (!Number.isFinite(widthInches) || widthInches <= 0) {
        return false;
    }

    const heightInches = widthInches * aspectRatio;

    heightInput.value = heightInches.toFixed(2);

    return true;
}


function resizeCanvasToOutput() {
    const widthInches = Number(widthInput.value);
    const outputPpi = Number(ppiInput.value);



    if (!Number.isFinite(widthInches) || widthInches <= 0) {
        return;
    }

    if (!Number.isFinite(outputPpi) || outputPpi <= 0 || outputPpi >1200) {
        return;
    }

    const heightInches = widthInches * aspectRatio;

    // Actual internal image resolution
    canvas.width = Math.round(widthInches * outputPpi);
    canvas.height = Math.round(heightInches * outputPpi);

    // Visual display size only
    canvas.style.width = "800px";
    canvas.style.height = "auto";
}



// clear the previously selected file on page reload
window.addEventListener('DOMContentLoaded', () => {
    if (inputElement) {
        inputElement.value = ''; // Clears the file
    }
});

// trigger the image pipeline on keystroke in form
imageForm.addEventListener("input", function(event) {
    if (!img) return;

    if (event.target === widthInput) {
        updatePhysicalDimensions();
        resizeCanvasToOutput();
    }

    if (event.target === ppiInput)  {
        resizeCanvasToOutput();
    }

    processImagePipeline();
});


// Set up image download on button press
const submitFormButton = document.getElementById("submit-edit-form");
submitFormButton.addEventListener("click", () => {
	processImagePipeline();
	downloadImage();
});


// embed the image in a pdf and download it on a button press
function downloadImage() {
    const { jsPDF } = window.jspdf;

    const imgWidth = Number(widthInput.value);
    const imgHeight = Number(heightInput.value);

    const addBorder =
        document.getElementById("border-checkbox");

    const makeBorderWhite =
        document.getElementById("invert-border-checkbox");

    const margin = addBorder.checked ? 0.125 : 0;

    const pdf = new jsPDF({
        orientation: imgHeight >= imgWidth
            ? "portrait"
            : "landscape",

        unit: "in",

        format: [
            imgWidth + margin * 2,
            imgHeight + margin * 2
        ]
    });

    if (addBorder.checked && !makeBorderWhite.checked) {
        pdf.setFillColor(0, 0, 0);

        pdf.rect(
            0,
            0,
            imgWidth + margin * 2,
            imgHeight + margin * 2,
            "F"
        );
    }

    const canvasImgData = canvas.toDataURL("image/png");

    pdf.addImage(
        canvasImgData,
        "PNG",
        margin,
        margin,
        imgWidth,
        imgHeight
    );

    pdf.save("rapidmask-image.pdf");
}

var mode = "halftone";
const halftoneTab = document.querySelector('button[data-bs-target="#halftone-tab-pane"]');
halftoneTab.addEventListener('show.bs.tab', event => {
	mode = "halftone";
	processImagePipeline();
});

const thresholdTab = document.querySelector('button[data-bs-target="#threshold-tab-pane"]');
thresholdTab.addEventListener('show.bs.tab', event => {
	mode = "threshold";
	processImagePipeline();
});

const invertCheckbox = document.getElementById('invert-checkbox');
const thresholdSlider = document.getElementById("threshold-slider");
invertCheckbox.addEventListener('click', () => {
	thresholdSlider.value = 255 - thresholdSlider.value;
});

const contrastSlider = document.getElementById("contrast-slider");
contrastSlider.value = 0;

const angle = document.getElementById("angle-slider");
angle.value = 37.5;

document.getElementById("lpi-45").checked = true;

// this is the main image processing pipeline that updates on each keystroke in the edit form
function processImagePipeline() {
	if (!img) return;
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	drawImageScaled(img, ctx, 'contain');
	adjustContrast(Number(contrastSlider.value));
	convertToGrayscale();

	if (mode == "halftone") {
		adjustLevels(20, 220, 1.0);

		const shape = document.querySelector('input[name="shape"]:checked');
		const selectedLpi = document.querySelector('input[name="lpi"]:checked');
		applyHalftone(canvas.width, canvas.height, Number(selectedLpi.value), angle.value, invertCheckbox.checked);
	} else if (mode == "threshold") {
		applyThreshold(thresholdSlider.value, invertCheckbox.checked);	


	}
}

// adjust levels for the 90-10 rule
function adjustLevels(shadowInput, highlightInput, gamma) {
    // shadowInput: 0 to 255 (Black point)
    // highlightInput: 0 to 255 (White point)
    // gamma: usually 0.1 to 9.9 (Midtone/gamma correction, default 1.0)
    
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imgData.data;
    
    // 1. Build a 256-entry lookup table (LUT) for performance
    const lut = new Uint8ClampedArray(256);
    for (let i = 0; i < 256; i++) {
        // Normalize input to 0..1 range based on black and white inputs
        let val = (i - shadowInput) / (highlightInput - shadowInput);
        val = Math.max(0, Math.min(1, val)); // Clamp to 0..1
        
        // Apply gamma correction
        val = Math.pow(val, 1 / gamma);
        
        // Map back to 0..255
        lut[i] = Math.round(val * 255);
    }
    
    // 2. Apply LUT to image pixels (r, g, b)
    for (let i = 0; i < pixels.length; i += 4) {
        pixels[i]     = lut[pixels[i]];     // Red
        pixels[i + 1] = lut[pixels[i + 1]]; // Green
        pixels[i + 2] = lut[pixels[i + 2]]; // Blue
        // pixels[i + 3] is Alpha, leave unchanged
    }
    
    // 3. Put modified data back on the canvas
    ctx.putImageData(imgData, 0, 0);
}

// applies a halftone effect to a canvas with settable lpi and angle
function applyHalftone(width, height, lpi, angle, invert) {

    const imgData = ctx.getImageData(0, 0, width, height);
    const pixels = imgData.data;

    ctx.fillStyle = invert ? '#000000' : '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = invert ? '#ffffff' : "#000000";

	const outputPpi = Number(ppiInput.value);
	const spacing = Math.max(1.5, outputPpi / lpi);

    const radians = (angle * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    const maxDim = Math.sqrt(width * width + height * height);
    
    for (let u = -maxDim; u < maxDim; u += spacing) {
        for (let v = -maxDim; v < maxDim; v += spacing) {
            
            const x = Math.floor(u * cos - v * sin + width / 2);
            const y = Math.floor(u * sin + v * cos + height / 2);

            if (x >= 0 && x < width && y >= 0 && y < height) {
                const index = (y * width + x) * 4;
                
                const r = pixels[index];
                const g = pixels[index + 1];
                const b = pixels[index + 2];
                
                const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
                const darkness = (255 - brightness) / 255;
                
                // Radius scales dynamically relative to the smaller spacing size
                const maxRadius = spacing * 0.68; 
                const radius = maxRadius * Math.sqrt(darkness);

                if (radius > 0.1) {
                    ctx.beginPath();
                    ctx.arc(x, y, radius, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }
}

function adjustContrast(contrastValue) {
    
    // 1. Extract the raw pixel data
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data; // Array of [R, G, B, A, R, G, B, A...]
    
    // 2. Calculate the contrast factor matrix
    // contrastValue ranges from -255 to 255
    const factor = (259 * (contrastValue + 255)) / (255 * (259 - contrastValue));
    
    // 3. Loop through every pixel (step by 4 for R, G, B, A channels)
    for (let i = 0; i < data.length; i += 4) {
        data[i]     = factor * (data[i] - 128) + 128;     // Red
        data[i + 1] = factor * (data[i + 1] - 128) + 128; // Green
        data[i + 2] = factor * (data[i + 2] - 128) + 128; // Blue
        // data[i+3] is Alpha (opacity), which we leave untouched
    }
    
    // 4. Overwrite the canvas pixels with the updated data
    ctx.putImageData(imgData, 0, 0);
}


// converts image data to grayscale
function convertToGrayscale() {
	const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
	const data = imageData.data;

	for (let i = 0; i < data.length; i+=4) {
		const r = data[i];     // Red
	    const g = data[i + 1]; // Green
	    const b = data[i + 2]; // Blue
	    // data[i + 3] is Alpha (transparency), we can skip modifying it

	    // 3. Calculate perceptual luminance (brightness)
	    const v = (0.2126 * r) + (0.7152 * g) + (0.0722 * b);


	    data[i]     = v; // New Red
	    data[i + 1] = v; // New Green
	    data[i + 2] = v; // New Blue
	}
 	ctx.putImageData(imageData, 0, 0);
}

// apply a threshold to a grayscale image
function applyThreshold(threshold, invert) {

  // 1. Get the RGBA pixel array from the canvas
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data; // A flat array of integers (0-255)

  // 2. Loop through every pixel (4 elements per pixel: R, G, B, A) and we can skip G and B since it's grayscale so they should be the same.
  for (let i = 0; i < data.length; i += 4) {
    const v = invert ? data[i] : 255 - data[i];     // Gray value
    // data[i + 3] is Alpha (transparency), we can skip modifying it

    // 3. Force the pixel to pure white or pure black based on threshold
    const finalColor = v >= threshold ? 255 : 0;

    data[i]     = finalColor; // New Red
    data[i + 1] = finalColor; // New Green
    data[i + 2] = finalColor; // New Blue
  }
	ctx.putImageData(imageData, 0, 0);
}

// draw the image on the canvas
function drawImageScaled(img, ctx, mode = 'contain') {
	const canvasWidth = ctx.canvas.width;
	const canvasHeight = ctx.canvas.height;

	// Calculate scale ratios
	const hRatio = canvasWidth / img.width;
	const vRatio = canvasHeight / img.height;

	// Determine the correct ratio depending on the chosen mode
	// Use Math.min for 'contain' (fit inside), Math.max for 'cover' (fill up)
	const ratio = (mode === 'contain') ? Math.min(hRatio, vRatio) : Math.max(hRatio, vRatio);

	// Center the image on the canvas
	const centerShift_x = (canvasWidth - img.width * ratio) / 2;
	const centerShift_y = (canvasHeight - img.height * ratio) / 2;

	ctx.drawImage(
		img,
		0, 0, img.width, img.height, // Source rectangle
		centerShift_x, centerShift_y, img.width * ratio, img.height * ratio // Destination rectangle
	);
}



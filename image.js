
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

// set up canvas
const canvas = document.getElementById('preview')
const ctx = canvas.getContext('2d')

canvas.width = 800;
canvas.height = 600;

// add a listener for image submission
const inputElement = document.getElementById('image-input');
inputElement.addEventListener('change', handleFile, false);

// set up image submission that triggers display on canvas and showing the image editing menu
function handleFile(e) {
	const file = e.target.files[0]

	if (!file) return;

	const reader = new FileReader();

	reader.onload = function(event) {
		const img = new Image();
		img.onload = function() {
			ctx.clearRect(0, 0, canvas.width, canvas.height)

			drawImageScaled(img, ctx, 'contain')
		};

		img.src = event.target.result
	};

	reader.readAsDataURL(file);
	
}

window.addEventListener('DOMContentLoaded', () => {
    if (inputElement) {
        inputElement.value = ''; // Clears the file
    }
});

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



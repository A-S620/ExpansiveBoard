const canvas = document.getElementById('canvas');
let scale = 1;
let offsetX = 0;
let offsetY = 0;
let isDraggingCanvas = false;
let lastMouseX = 0;
let lastMouseY = 0;
let selectedItem = null;
let isResizing = false;
let items = [];
let nextId = 1;

// Center the canvas initially
resetView();

// Add event listeners
document.getElementById('add-text-btn').addEventListener('click', addTextItem);
document.getElementById('add-image-btn').addEventListener('click', () => document.getElementById('file-input').click());
document.getElementById('add-link-btn').addEventListener('click', addLinkItem);
document.getElementById('save-btn').addEventListener('click', saveBoard);
document.getElementById('load-btn').addEventListener('click', loadBoard);
document.getElementById('reset-btn').addEventListener('click', resetView);
document.getElementById('clear-btn').addEventListener('click', clearBoard);
document.getElementById('file-input').addEventListener('change', handleImageUpload);

// Add paste event listener to the document
document.addEventListener('paste', handlePaste);
document.addEventListener('keydown', handleKeyDown);

canvas.addEventListener('mousedown', startDrag);
window.addEventListener('mousemove', drag);
window.addEventListener('mouseup', endDrag);
canvas.addEventListener('wheel', zoom);

function addTextItem(text = null) {
    if (text === null) {
        text = prompt('Enter your text:');
        if (!text) return;
    }

    const item = {
        id: nextId++,
        type: 'text',
        content: text,
        x: -offsetX + window.innerWidth / 2 / scale - 100,
        y: -offsetY + window.innerHeight / 2 / scale - 50,
        width: 200,
        height: 'auto'
    };

    items.push(item);
    renderItem(item);
    return item;
}

function addLinkItem() {
    const url = prompt('Enter URL:');
    if (!url) return;

    const title = prompt('Enter link title (optional):') || url;

    const item = {
        id: nextId++,
        type: 'link',
        url: url.startsWith('http') ? url : `https://${url}`,
        title: title,
        x: -offsetX + window.innerWidth / 2 / scale - 100,
        y: -offsetY + window.innerHeight / 2 / scale - 25,
        width: 200,
        height: 'auto'
    };

    items.push(item);
    renderItem(item);
    return item;
}

// Handle keyboard shortcuts
function handleKeyDown(e) {
    // Ctrl+D or Cmd+D for duplicate
    if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selectedItem) {
        e.preventDefault();
        duplicateItem(selectedItem);
    }
}

// Duplicate an item
function duplicateItem(element) {
    const id = parseInt(element.dataset.id);
    const originalItem = items.find(item => item.id === id);

    if (!originalItem) return;

    // Create a deep copy of the item
    const newItem = JSON.parse(JSON.stringify(originalItem));

    // Assign a new ID
    newItem.id = nextId++;

    // Offset the position slightly for visibility
    newItem.x += 20;
    newItem.y += 20;

    // Add to items array
    items.push(newItem);

    // Render the duplicated item
    const newElement = renderItem(newItem);

    // Select the new item
    selectedItem = newElement;

    return newItem;
}

// Handle paste event
function handlePaste(e) {
    // Prevent paste if we're inside a text item already (let default paste work in contentEditable)
    if (e.target.closest('.text-item')) {
        return;
    }

    // Get clipboard data
    const clipboardData = e.clipboardData;

    // Check if the clipboard has any image data
    const items = clipboardData.items;

    let hasHandledItem = false;

    // First check for images
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            // Get the image as a Blob
            const blob = items[i].getAsFile();

            // Process the pasted image
            processPastedImage(blob);

            // Prevent the default paste behavior
            e.preventDefault();
            hasHandledItem = true;
            break;
        }
    }

    // If no image was found, check for text
    if (!hasHandledItem) {
        const text = clipboardData.getData('text/plain');
        if (text && text.trim().length > 0) {
            addTextItem(text);
            e.preventDefault();
        }
    }
}
/**
 * Compresses an image to reduce file size
 * @param {string} dataUrl - The image data URL to compress
 * @param {number} maxWidth - Maximum width for the compressed image
 * @param {number} quality - JPEG quality (0-1)
 * @returns {Promise<string>} - A promise that resolves with the compressed image data URL
 */
function compressImage(dataUrl, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = function() {
            // Create a canvas for the compressed image
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // Scale down if larger than maxWidth
            if (width > maxWidth) {
                height = (maxWidth / width) * height;
                width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;

            // Draw and compress the image
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Convert to JPEG with specified quality
            const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

            resolve(compressedDataUrl);
        };

        img.onerror = function() {
            reject(new Error('Failed to load image for compression'));
        };

        img.src = dataUrl;
    });
}

// Function to handle image uploads with compression
async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            // Compress the image
            const compressedImage = await compressImage(e.target.result, 800, 0.7);

            const img = new Image();
            img.onload = function() {
                const maxWidth = 300;
                const maxHeight = 300;
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }

                if (height > maxHeight) {
                    width = (maxHeight / height) * width;
                    height = maxHeight;
                }

                const item = {
                    id: nextId++,
                    type: 'image',
                    src: compressedImage, // Use compressed image
                    x: -offsetX + window.innerWidth / 2 / scale - width / 2,
                    y: -offsetY + window.innerHeight / 2 / scale - height / 2,
                    width: width,
                    height: height,
                    imageSaved: true
                };

                items.push(item);
                renderItem(item);
            };
            img.src = compressedImage;
        } catch (error) {
            console.error('Error compressing image:', error);
            alert('Error processing image. Please try again with a different image.');
        }
    };
    reader.readAsDataURL(file);
    event.target.value = ''; // Reset file input
}

// Process pasted image
function processPastedImage(blob) {
    const reader = new FileReader();

    reader.onload = async function(e) {
        try {
            // Compress the pasted image
            const compressedImage = await compressImage(e.target.result, 800, 0.7);

            const img = new Image();
            img.onload = function() {
                const maxWidth = 300;
                const maxHeight = 300;
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }

                if (height > maxHeight) {
                    width = (maxHeight / height) * width;
                    height = maxHeight;
                }

                const item = {
                    id: nextId++,
                    type: 'image',
                    src: compressedImage, // Use compressed image
                    x: -offsetX + window.innerWidth / 2 / scale - width / 2,
                    y: -offsetY + window.innerHeight / 2 / scale - height / 2,
                    width: width,
                    height: height,
                    imageSaved: true
                };

                items.push(item);
                renderItem(item);
            };
            img.src = compressedImage;
        } catch (error) {
            console.error('Error compressing pasted image:', error);
            alert('Error processing pasted image.');
        }
    };

    reader.readAsDataURL(blob);
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const maxWidth = 300;
            const maxHeight = 300;
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                height = (maxWidth / width) * height;
                width = maxWidth;
            }

            if (height > maxHeight) {
                width = (maxHeight / height) * width;
                height = maxHeight;
            }

            const item = {
                id: nextId++,
                type: 'image',
                src: e.target.result,
                x: -offsetX + window.innerWidth / 2 / scale - width / 2,
                y: -offsetY + window.innerHeight / 2 / scale - height / 2,
                width: width,
                height: height
            };

            items.push(item);
            renderItem(item);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    event.target.value = ''; // Reset file input
}

function renderItem(item) {
    const itemElement = document.createElement('div');
    itemElement.className = `item ${item.type}-item`;
    itemElement.dataset.id = item.id;
    itemElement.style.left = `${item.x}px`;
    itemElement.style.top = `${item.y}px`;
    itemElement.style.width = `${item.width}px`;
    if (item.height !== 'auto') {
        itemElement.style.height = `${item.height}px`;
    }

    // Create delete button
    const deleteButton = document.createElement('div');
    deleteButton.className = 'delete-button';
    deleteButton.innerHTML = '×';
    deleteButton.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        deleteItem(item.id);
    });

    // Create duplicate button
    const duplicateButton = document.createElement('div');
    duplicateButton.className = 'duplicate-button';
    duplicateButton.innerHTML = '+';
    duplicateButton.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        duplicateItem(itemElement);
    });

    // Create resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    resizeHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        isResizing = true;
        selectedItem = itemElement;
    });

    // Add content based on item type
    if (item.type === 'text') {
        itemElement.contentEditable = true;
        itemElement.innerHTML = item.content;
        // Ensure delete button is not overwritten
        itemElement.appendChild(deleteButton);
        itemElement.appendChild(duplicateButton);
    } else if (item.type === 'image') {
        const img = document.createElement('img');
        img.src = item.src;
        itemElement.appendChild(img);
        itemElement.appendChild(deleteButton);
        itemElement.appendChild(duplicateButton);
    } else if (item.type === 'link') {
        const link = document.createElement('a');
        link.href = item.url;
        link.target = '_blank';
        link.textContent = item.title;
        itemElement.appendChild(link);
        itemElement.appendChild(deleteButton);
        itemElement.appendChild(duplicateButton);
    }

    itemElement.appendChild(resizeHandle);
    canvas.appendChild(itemElement);

    return itemElement;
}

function deleteItem(id) {
    items = items.filter(item => item.id !== id);
    const element = document.querySelector(`.item[data-id="${id}"]`);
    if (element) {
        element.remove();
    }
}

function startDrag(e) {
    if (e.target === canvas) {
        isDraggingCanvas = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        canvas.style.cursor = 'grabbing';
    } else if (e.target.closest('.item')) {
        selectedItem = e.target.closest('.item');

        // Bring to front
        canvas.appendChild(selectedItem);
    }
}

function drag(e) {
    if (isDraggingCanvas) {
        const deltaX = e.clientX - lastMouseX;
        const deltaY = e.clientY - lastMouseY;

        offsetX += deltaX / scale;
        offsetY += deltaY / scale;

        canvas.style.transform = `scale(${scale}) translate(${offsetX}px, ${offsetY}px)`;

        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
    } else if (selectedItem && !isResizing) {
        const deltaX = e.movementX / scale;
        const deltaY = e.movementY / scale;

        const id = parseInt(selectedItem.dataset.id);
        const item = items.find(item => item.id === id);

        if (item) {
            item.x += deltaX;
            item.y += deltaY;

            selectedItem.style.left = `${item.x}px`;
            selectedItem.style.top = `${item.y}px`;
        }
    } else if (selectedItem && isResizing) {
        const id = parseInt(selectedItem.dataset.id);
        const item = items.find(item => item.id === id);

        if (item) {
            const rect = selectedItem.getBoundingClientRect();
            const newWidth = Math.max(100, e.clientX - rect.left);
            const newHeight = Math.max(50, e.clientY - rect.top);

            item.width = newWidth / scale;

            if (item.type !== 'text' && item.type !== 'link') {
                item.height = newHeight / scale;
                selectedItem.style.height = `${item.height}px`;
            }

            selectedItem.style.width = `${item.width}px`;
        }
    }
}

function endDrag() {
    isDraggingCanvas = false;
    isResizing = false;
    selectedItem = null;
    canvas.style.cursor = 'default';
}

function zoom(e) {
    e.preventDefault();

    const scaleAmount = e.deltaY > 0 ? 0.9 : 1.1;
    const mouseX = e.clientX;
    const mouseY = e.clientY;

    // Calculate mouse position in canvas coordinates before scaling
    const canvasX = (mouseX / scale) - offsetX;
    const canvasY = (mouseY / scale) - offsetY;

    // Update scale
    scale *= scaleAmount;
    scale = Math.min(Math.max(0.1, scale), 5); // Limit scale between 0.1 and 5

    // Adjust offset to keep mouse position fixed
    offsetX = -(canvasX - mouseX / scale);
    offsetY = -(canvasY - mouseY / scale);

    canvas.style.transform = `scale(${scale}) translate(${offsetX}px, ${offsetY}px)`;
}

function resetView() {
    scale = 1;
    offsetX = (window.innerWidth / 2) - (canvas.offsetWidth / 2);
    offsetY = (window.innerHeight / 2) - (canvas.offsetHeight / 2);
    canvas.style.transform = `scale(${scale}) translate(${offsetX}px, ${offsetY}px)`;
}

function clearBoard() {
    if (confirm('Are you sure you want to clear the entire board? This cannot be undone.')) {
        items = [];
        canvas.innerHTML = '';
        nextId = 1;
    }
}

function saveBoard() {
    // Ask user if they want to include images (which make files large)
    const includeImages = confirm('Include images in the save file? (Choosing "No" will make the file smaller, but images will need to be re-added later)');

    // Update text content for editable items
    const textElements = document.querySelectorAll('.text-item');
    textElements.forEach(element => {
        const id = parseInt(element.dataset.id);
        const item = items.find(item => item.id === id);
        if (item) {
            // Clone the element to get content without control buttons
            const tempElement = element.cloneNode(true);
            const tempDeleteButton = tempElement.querySelector('.delete-button');
            const tempResizeHandle = tempElement.querySelector('.resize-handle');
            const tempDuplicateButton = tempElement.querySelector('.duplicate-button');

            if (tempDeleteButton) tempDeleteButton.remove();
            if (tempResizeHandle) tempResizeHandle.remove();
            if (tempDuplicateButton) tempDuplicateButton.remove();

            item.content = tempElement.innerHTML;
        }
    });

    // Create a clean version of the items array for saving
    const itemsToSave = items.map(item => {
        // Create a copy of the item
        const cleanItem = {...item};

        // Handle image items differently based on user choice
        if (item.type === 'image' && !includeImages) {
            // If not including images, replace src with a placeholder
            cleanItem.src = null;
            cleanItem.imageSaved = false;
        } else if (item.type === 'image' && includeImages) {
            // Optionally compress the image before saving
            cleanItem.imageSaved = true;
        }

        return cleanItem;
    });

    // Create board data object
    const boardData = {
        items: itemsToSave,
        nextId: nextId,
        version: '1.0', // Adding a version number for future compatibility
        savedAt: new Date().toISOString(),
        includesImages: includeImages
    };

    // Convert to JSON string
    const dataStr = JSON.stringify(boardData);

    // Show file size information
    const fileSizeKB = Math.round(dataStr.length / 1024);
    const fileSizeMB = (fileSizeKB / 1024).toFixed(2);

    console.log(`File size: ${fileSizeMB} MB (${fileSizeKB} KB)`);

    // If the file is very large, confirm with the user
    if (fileSizeKB > 5000) { // 5MB warning
        const continueWithLargeFile = confirm(`Warning: The save file is large (${fileSizeMB} MB). This may cause performance issues. Continue?`);
        if (!continueWithLargeFile) return;
    }

    // Create data URI and trigger download
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportName = 'vision_board_' + new Date().toISOString().slice(0,10) + '.json';

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportName);
    linkElement.click();
}

function loadBoard() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = e => {
        const file = e.target.files[0];
        const reader = new FileReader();

        reader.onload = function(event) {
            try {
                const boardData = JSON.parse(event.target.result);

                // Check for missing images
                const hasMissingImages = boardData.items.some(item =>
                    item.type === 'image' && item.imageSaved === false);

                if (hasMissingImages) {
                    alert('Note: Some images were not saved with this board and will need to be re-added.');
                }

                // Clear existing items
                items = [];
                canvas.innerHTML = '';

                // Load saved items
                items = boardData.items.filter(item => {
                    // Filter out image items that weren't saved
                    return !(item.type === 'image' && item.imageSaved === false);
                });

                nextId = boardData.nextId || items.length + 1;

                // Render all items
                items.forEach(item => renderItem(item));

            } catch (error) {
                alert('Error loading vision board: ' + error.message);
            }
        };

        reader.readAsText(file);
    };

    input.click();
}

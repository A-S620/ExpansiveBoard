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

canvas.addEventListener('mousedown', startDrag);
window.addEventListener('mousemove', drag);
window.addEventListener('mouseup', endDrag);
canvas.addEventListener('wheel', zoom);

function addTextItem() {
    const text = prompt('Enter your text:');
    if (!text) return;

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
    } else if (item.type === 'image') {
        const img = document.createElement('img');
        img.src = item.src;
        itemElement.appendChild(img);
        itemElement.appendChild(deleteButton);
    } else if (item.type === 'link') {
        const link = document.createElement('a');
        link.href = item.url;
        link.target = '_blank';
        link.textContent = item.title;
        itemElement.appendChild(link);
        itemElement.appendChild(deleteButton);
    }

    itemElement.appendChild(resizeHandle);
    canvas.appendChild(itemElement);
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
    // Update text content for editable items
    const textElements = document.querySelectorAll('.text-item');
    textElements.forEach(element => {
        const id = parseInt(element.dataset.id);
        const item = items.find(item => item.id === id);
        if (item) {
            // Filter out the delete button and resize handle from the content
            const deleteButton = element.querySelector('.delete-button');
            const resizeHandle = element.querySelector('.resize-handle');

            const tempElement = element.cloneNode(true);
            const tempDeleteButton = tempElement.querySelector('.delete-button');
            const tempResizeHandle = tempElement.querySelector('.resize-handle');

            if (tempDeleteButton) tempDeleteButton.remove();
            if (tempResizeHandle) tempResizeHandle.remove();

            item.content = tempElement.innerHTML;
        }
    });

    const boardData = {
        items: items,
        nextId: nextId
    };

    const dataStr = JSON.stringify(boardData);
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

                // Clear existing items
                items = [];
                canvas.innerHTML = '';

                // Load saved items
                items = boardData.items;
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

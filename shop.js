const productContainer = document.getElementById("productContainer");
const searchInput = document.getElementById("searchInput");
const clearSearch = document.getElementById("clearSearch");
const resultInfo = document.getElementById("resultInfo");

let searchText = "";
let searchTimer = null;

// State of the open product view
let openId = null;
let selColour = null;
let selSize = null;
let imgIndex = 0;
let qty = 1;
let modalPushed = false;

// cart.js calls this after an order so the stock numbers refresh
function refreshShopView() {
    displayProducts();
    if (openId && !modal.hidden) renderModal(false);
}

/* ================= SEARCH ================= */

searchInput.addEventListener("input", () => {
    clearSearch.hidden = searchInput.value === "";

    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        searchText = searchInput.value;
        displayProducts();
    }, 200);
});

clearSearch.addEventListener("click", () => {
    searchInput.value = "";
    searchText = "";
    clearSearch.hidden = true;
    displayProducts();
    searchInput.focus();
});

// Matches the product name, description and colour names
function visibleProducts() {
    const words = searchText.trim().toLowerCase().split(/\s+/).filter(Boolean);

    if (words.length === 0) return products;

    return products.filter(product => {
        const haystack = [
            product.name,
            product.description,
            ...(product.colours || []).map(colour => colour.name)
        ].join(" ").toLowerCase();

        return words.every(word => haystack.includes(word));
    });
}

/* ================= PRODUCT GRID ================= */

function totalStock(product) {
    return (product.colours || []).reduce((sum, colour) =>
        sum + Object.values(colour.stock || {})
            .reduce((a, b) => a + Number(b || 0), 0), 0);
}

function displayProducts() {
    productContainer.replaceChildren();

    const list = visibleProducts();

    resultInfo.textContent = products.length === 0 || !searchText.trim()
        ? ""
        : `${list.length} item${list.length === 1 ? "" : "s"} matching "${searchText.trim()}"`;

    if (list.length === 0) {
        productContainer.textContent = products.length === 0
            ? "No clothes available yet. Please check back soon."
            : "No items match. Try a different word.";

        renderCart();
        return;
    }

    list.forEach(product => {
        const tile = document.createElement("button");
        tile.type = "button";
        tile.className = "tile";

        const frame = document.createElement("div");
        frame.className = "tile-photo";

        const photo = (product.colours || []).flatMap(c => c.images)[0];

        if (photo) {
            const image = document.createElement("img");
            image.src = photo;
            image.alt = product.name;
            image.loading = "lazy";
            image.decoding = "async";
            frame.appendChild(image);
        }

        if (totalStock(product) === 0) {
            const badge = document.createElement("span");
            badge.className = "tile-badge";
            badge.textContent = "Sold out";
            frame.appendChild(badge);
        }

        const name = document.createElement("h3");
        name.textContent = product.name;

        const price = document.createElement("p");
        price.className = "tile-price";
        price.textContent = money(Number(product.price));

        tile.append(frame, name, price);
        tile.addEventListener("click", () => openProduct(product.id));

        productContainer.appendChild(tile);
    });

    renderCart();
}

/* ================= PRODUCT VIEW ================= */

const modal = document.createElement("div");
modal.className = "pm-overlay";
modal.hidden = true;
modal.innerHTML = `
    <div class="pm-dialog" role="dialog" aria-modal="true">
        <button type="button" class="pm-close" aria-label="Close">✕</button>

        <div class="pm-gallery">
            <img class="pm-main" alt="">
            <div class="pm-thumbs"></div>
        </div>

        <div class="pm-info">
            <h2 class="pm-title"></h2>
            <p class="pm-price"></p>
            <p class="pm-desc"></p>

            <div class="pm-group">
                <span class="pm-label">Colour: <b class="pm-colour-name"></b></span>
                <div class="pm-options pm-colours"></div>
            </div>

            <div class="pm-group">
                <span class="pm-label">Size: <b class="pm-size-name"></b></span>
                <div class="pm-options pm-sizes"></div>
            </div>

            <p class="pm-stock"></p>

            <div class="pm-group">
                <span class="pm-label">Quantity</span>
                <div class="pm-qty">
                    <button type="button" class="pm-minus" aria-label="Less">−</button>
                    <input type="number" class="pm-qty-input" min="1" step="1" value="1">
                    <button type="button" class="pm-plus" aria-label="More">+</button>
                </div>
            </div>

            <p class="pm-total"></p>

            <button type="button" class="pm-add">Add to Cart</button>
        </div>
    </div>
`;
document.body.appendChild(modal);

const pm = {
    dialog: modal.querySelector(".pm-dialog"),
    close: modal.querySelector(".pm-close"),
    main: modal.querySelector(".pm-main"),
    thumbs: modal.querySelector(".pm-thumbs"),
    title: modal.querySelector(".pm-title"),
    price: modal.querySelector(".pm-price"),
    desc: modal.querySelector(".pm-desc"),
    colours: modal.querySelector(".pm-colours"),
    colourName: modal.querySelector(".pm-colour-name"),
    sizes: modal.querySelector(".pm-sizes"),
    sizeName: modal.querySelector(".pm-size-name"),
    stock: modal.querySelector(".pm-stock"),
    minus: modal.querySelector(".pm-minus"),
    plus: modal.querySelector(".pm-plus"),
    qty: modal.querySelector(".pm-qty-input"),
    total: modal.querySelector(".pm-total"),
    add: modal.querySelector(".pm-add")
};

// First size that is in stock for a colour
function pickDefaultSize(product, colourName) {
    const sizes = sizesFor(product);
    return sizes.find(size => getStock(product.id, colourName, size) > 0) || sizes[0];
}

function openProduct(id, push = true) {
    const product = findProduct(id);
    if (!product) return;

    openId = id;
    selColour = product.colours[0]?.name ?? null;
    selSize = pickDefaultSize(product, selColour);
    imgIndex = 0;
    qty = 1;

    renderModal(true);

    modal.hidden = false;
    document.body.classList.add("pm-open");
    pm.dialog.scrollTop = 0;

    if (push) {
        history.pushState({ modal: id }, "", `#p-${id}`);
        modalPushed = true;
    } else {
        modalPushed = false;
    }
}

function hideModal() {
    modal.hidden = true;
    document.body.classList.remove("pm-open");
    openId = null;
    modalPushed = false;
}

function closeModal() {
    if (modal.hidden) return;

    if (modalPushed) {
        // The popstate handler below hides it
        history.back();
    } else {
        hideModal();

        if (location.hash.startsWith("#p-")) {
            history.replaceState(null, "", location.pathname + location.search);
        }
    }
}

window.addEventListener("popstate", () => {
    if (!modal.hidden) hideModal();
});

pm.close.addEventListener("click", closeModal);

modal.addEventListener("click", event => {
    if (event.target === modal) closeModal();
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !modal.hidden &&
        !cartSection.classList.contains("open")) {
        closeModal();
    }
});

function setQty(value) {
    const stock = getStock(openId, selColour, selSize);
    qty = Math.max(1, Math.min(stock, Math.floor(Number(value)) || 1));
    renderModal(false);
}

pm.minus.addEventListener("click", () => setQty(qty - 1));
pm.plus.addEventListener("click", () => setQty(qty + 1));
pm.qty.addEventListener("change", () => setQty(pm.qty.value));

function renderModal(resetImage) {
    const product = findProduct(openId);

    if (!product) {
        hideModal();
        return;
    }

    if (resetImage) imgIndex = 0;

    const colour = findColour(product, selColour) || product.colours[0];
    if (colour && colour.name !== selColour) selColour = colour.name;

    pm.title.textContent = product.name;
    pm.price.textContent = money(Number(product.price));
    pm.desc.textContent = product.description || "";
    pm.desc.hidden = !product.description;

    /* Photos */
    const images = colour?.images || [];
    if (imgIndex >= images.length) imgIndex = 0;

    pm.main.src = images[imgIndex] || "";
    pm.main.alt = `${product.name} - ${selColour || ""}`;

    pm.thumbs.replaceChildren();

    if (images.length > 1) {
        images.forEach((src, i) => {
            const thumb = document.createElement("img");
            thumb.src = src;
            thumb.alt = `${product.name} photo ${i + 1}`;
            thumb.className = i === imgIndex ? "active" : "";

            thumb.addEventListener("click", () => {
                imgIndex = i;
                renderModal(false);
            });

            pm.thumbs.appendChild(thumb);
        });
    }

    /* Colours */
    pm.colourName.textContent = selColour || "";
    pm.colours.replaceChildren();

    product.colours.forEach(item => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "pm-chip" + (item.name === selColour ? " active" : "");
        chip.textContent = item.name;

        chip.addEventListener("click", () => {
            selColour = item.name;

            if (getStock(product.id, selColour, selSize) < 1) {
                selSize = pickDefaultSize(product, selColour);
            }

            qty = 1;
            renderModal(true);
        });

        pm.colours.appendChild(chip);
    });

    /* Sizes */
    pm.sizeName.textContent = sizeText(selSize);
    pm.sizes.replaceChildren();

    sizesFor(product).forEach(size => {
        const out = getStock(product.id, selColour, size) < 1;

        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "pm-chip" +
            (size === selSize ? " active" : "") +
            (out ? " out" : "");
        chip.textContent = sizeText(size);

        chip.addEventListener("click", () => {
            selSize = size;
            qty = 1;
            renderModal(false);
        });

        pm.sizes.appendChild(chip);
    });

    /* Stock, quantity, total */
    const stock = getStock(product.id, selColour, selSize);

    if (stock < 1) {
        const held = getReservedQty(product.id, selColour, selSize);

        pm.stock.className = "pm-stock none";
        pm.stock.textContent = held > 0
            ? "Reserved by another customer. It returns to stock if unpaid after 2 hours. Message us on WhatsApp to be notified."
            : "This option is out of stock.";

        qty = 0;
        pm.total.textContent = "";
    } else {
        if (qty < 1 || qty > stock) qty = 1;

        pm.stock.className = "pm-stock" + (stock <= 3 ? " low" : "");
        pm.stock.textContent = stock <= 3
            ? `Only ${stock} left`
            : `Available stock: ${stock}`;

        pm.total.textContent = `Total: ${money(qty * Number(product.price))}`;
    }

    pm.qty.value = String(qty);
    pm.qty.max = String(stock);
    pm.qty.disabled = stock < 1;
    pm.minus.disabled = stock < 1 || qty <= 1;
    pm.plus.disabled = stock < 1 || qty >= stock;
    pm.add.disabled = stock < 1;
}

pm.add.addEventListener("click", async () => {
    const productId = openId;
    const colourName = selColour;
    const size = selSize;
    const quantity = qty;

    if (!productId) return;

    pm.add.disabled = true;

    // Check the newest stock before adding to the cart
    try {
        await loadProducts();
    } catch {
        alert("Could not check stock. Please check your internet connection.");
        renderModal(false);
        return;
    }

    const latestProduct = findProduct(productId);
    const latestColour = findColour(latestProduct, colourName);

    if (!latestProduct || !latestColour) {
        alert("This product is no longer available.");
        hideModal();
        displayProducts();
        return;
    }

    const stock = Number(latestColour.stock?.[size] ?? 0);

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > stock) {
        alert("Please select a valid quantity within available stock.");
        renderModal(false);
        return;
    }

    const existingItem = cart.find(item =>
        item.productId === productId &&
        item.colourName === colourName &&
        item.size === size
    );

    const newQuantity = (existingItem?.quantity || 0) + quantity;

    if (newQuantity > stock) {
        alert(
            `You can add only ${Math.max(
                0, stock - (existingItem?.quantity || 0)
            )} more of this option.`
        );
        renderModal(false);
        return;
    }

    const previousCart = JSON.stringify(cart);

    if (existingItem) {
        existingItem.quantity = newQuantity;
        existingItem.price = Number(latestProduct.price);
    } else {
        cart.push({
            productId,
            colourName,
            size,
            quantity,
            price: Number(latestProduct.price)
        });
    }

    if (!saveCart()) {
        cart = JSON.parse(previousCart);
        renderModal(false);
        return;
    }

    renderCart();
    closeModal();
    openCart();
});

// Open a product straight from a link like shop.html#p-<id>
function openFromHash() {
    const id = location.hash.slice(1);
    if (!id.startsWith("p-")) return;

    openProduct(id.slice(2), false);
}

(async function start() {
    await productsReady;

    if (productsLoadFailed) {
        productContainer.textContent =
            "We could not load the collection. Please check your internet connection and refresh.";
        return;
    }

    // Keep anything the browser restored into the search box
    searchText = searchInput.value;
    clearSearch.hidden = searchInput.value === "";

    displayProducts();
    openFromHash();
})();
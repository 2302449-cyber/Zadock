/* cart.js: loaded on every page.
   Holds the product data, the cart drawer and the checkout. */

const CART_KEY = "africanEleganceCart";
const SIZES = SIZE_LIST;

let products = [];
let reservedRows = [];
let productsLoadFailed = false;

function readCart() {
    try {
        const data = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

let cart = readCart();

/* ================= CART DRAWER ================= */

const cartSection = document.createElement("section");
cartSection.id = "shoppingCart";

const cartHeading = document.createElement("h2");
cartHeading.textContent = "Your Shopping Cart";

const cartItemsContainer = document.createElement("div");
cartItemsContainer.id = "cartItems";

const cartTotal = document.createElement("h3");
cartTotal.id = "cartTotal";

const closeCartButton = document.createElement("button");
closeCartButton.type = "button";
closeCartButton.id = "closeCart";
closeCartButton.textContent = "✕ Close";

const cartOverlay = document.createElement("div");
cartOverlay.id = "cartOverlay";

cartSection.append(closeCartButton, cartHeading, cartItemsContainer, cartTotal);
document.body.append(cartOverlay, cartSection);

function openCart() {
    cartSection.classList.add("open");
    cartOverlay.classList.add("open");
}

function closeCart() {
    cartSection.classList.remove("open");
    cartOverlay.classList.remove("open");
}

document.addEventListener("click", event => {
    if (event.target.closest("#cartToggle")) openCart();
});
closeCartButton.addEventListener("click", closeCart);
cartOverlay.addEventListener("click", closeCart);

/* ================= HELPERS ================= */

function money(amount) {
    return `KSh ${amount.toLocaleString("en-KE")}`;
}

function saveCart() {
    try {
        localStorage.setItem(CART_KEY, JSON.stringify(cart));
        return true;
    } catch {
        alert("Could not save your cart in this browser.");
        return false;
    }
}

function updateCartCount() {
    const element = document.getElementById("cartCount");
    if (element) {
        element.textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
    }
}

function findProduct(productId) {
    return products.find(product => product.id === productId);
}

function findColour(product, colourName) {
    return product?.colours?.find(colour => colour.name === colourName);
}

function getStock(productId, colourName, size) {
    const colour = findColour(findProduct(productId), colourName);
    return Number(colour?.stock?.[size] ?? 0);
}

// How many pieces of one option are held by unpaid orders
function getReservedQty(productId, colourName, size) {
    return reservedRows
        .filter(row =>
            row.product_id === productId &&
            row.colour === colourName &&
            row.size === size)
        .reduce((sum, row) => sum + Number(row.qty), 0);
}

// Download the latest products, photos, stock and holds
async function loadProducts() {
    const { data, error } = await sb
        .from("products")
        .select("*, product_colours(*)")
        .order("created_at", { ascending: false });

    if (error) throw error;

    products = data.map(product => ({
        id: product.id,
        name: product.name,
        price: product.price,
        description: product.description,
        colours: (product.product_colours || [])
            .sort((a, b) => a.position - b.position)
            .map(colour => ({
                name: colour.name,
                images: colour.images || [],
                stock: colour.stock || {}
            }))
    }));

    // Counts only, no personal details
    const { data: held } = await sb.rpc("reserved_stock");
    reservedRows = held || [];
}

/* ================= CART LIST ================= */

function renderCart() {
    cartItemsContainer.replaceChildren();
    updateCartCount();

    if (productsLoadFailed && cart.length > 0) {
        cartItemsContainer.textContent =
            "We could not load your cart details. Please check your internet and refresh.";
        cartTotal.textContent = "";
        return;
    }

    let subtotal = 0;

    if (cart.length === 0) {
        cartItemsContainer.textContent = "Your cart is empty.";
    }

    cart.forEach((item, index) => {
        const product = findProduct(item.productId);
        const colour = findColour(product, item.colourName);

        const row = document.createElement("div");
        row.className = "cart-item";

        const details = document.createElement("p");

        if (!product || !colour) {
            details.textContent = "This product or colour is no longer available.";

            const removeButton = document.createElement("button");
            removeButton.type = "button";
            removeButton.textContent = "Remove";
            removeButton.addEventListener("click", () => {
                cart.splice(index, 1);
                if (saveCart()) renderCart();
            });

            row.append(details, removeButton);
            cartItemsContainer.appendChild(row);
            return;
        }

        const price = Number(product.price);
        const stock = getStock(item.productId, item.colourName, item.size);

        item.price = price;

        details.textContent =
            `${product.name} | ${item.colourName} | ` +
            `${item.size === ONE_SIZE ? "One Size" : "Size " + item.size} | ` +
            `${item.quantity} × ${money(price)}`;

        const lineTotal = price * item.quantity;

        const lineTotalText = document.createElement("p");
        lineTotalText.textContent = `Subtotal: ${money(lineTotal)}`;

        const quantityLabel = document.createElement("label");
        quantityLabel.textContent = "Cart quantity: ";

        const quantityInput = document.createElement("input");
        quantityInput.type = "number";
        quantityInput.min = "1";
        quantityInput.max = String(stock);
        quantityInput.step = "1";
        quantityInput.value = String(item.quantity);
        quantityInput.disabled = stock < 1;

        quantityInput.addEventListener("change", () => {
            const quantity = Number(quantityInput.value);

            if (!Number.isInteger(quantity) || quantity < 1 || quantity > stock) {
                alert("Enter a whole quantity within available stock.");
                quantityInput.value = String(item.quantity);
                return;
            }

            const oldQuantity = item.quantity;
            item.quantity = quantity;

            if (saveCart()) {
                renderCart();
            } else {
                item.quantity = oldQuantity;
                quantityInput.value = String(oldQuantity);
            }
        });

        quantityLabel.appendChild(quantityInput);

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "remove";
        removeButton.textContent = "Remove item";

        removeButton.addEventListener("click", () => {
            const removedItem = cart.splice(index, 1)[0];

            if (saveCart()) {
                renderCart();
            } else {
                cart.splice(index, 0, removedItem);
            }
        });

        row.append(details, lineTotalText, quantityLabel, removeButton);
        cartItemsContainer.appendChild(row);
        subtotal += lineTotal;
    });

    cartTotal.textContent = `Cart subtotal: ${money(subtotal)}`;
}

/* ================= CHECKOUT ================= */

const checkoutForm = document.createElement("form");
checkoutForm.id = "checkoutForm";
checkoutForm.innerHTML = `
    <h3>Your Details</h3>

    <label for="custName">Full name</label>
    <input type="text" id="custName" required>

    <label for="custPhone">Phone number</label>
    <input type="tel" id="custPhone" placeholder="e.g. 0712345678" required>

    <label for="custAddress">Delivery location</label>
    <textarea id="custAddress" rows="3"
        placeholder="Town, estate, building or pickup point" required></textarea>

    <label for="custNotes">Notes (optional)</label>
    <input type="text" id="custNotes" placeholder="Anything we should know?">

    <button type="submit" id="placeOrder">Place Order on WhatsApp</button>

    <p class="checkout-help">
        Your order opens in WhatsApp. We hold your items for 2 hours
        while you complete payment.
    </p>
`;
cartSection.appendChild(checkoutForm);

checkoutForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (cart.length === 0) {
        alert("Your cart is empty.");
        return;
    }

    const placeButton = document.getElementById("placeOrder");
    placeButton.disabled = true;
    placeButton.textContent = "Placing your order...";

    // Open the WhatsApp tab right now. Browsers block tabs opened after waiting.
    const whatsappTab = window.open("", "_blank");

    try {
        const customer = {
            name: document.getElementById("custName").value.trim(),
            phone: document.getElementById("custPhone").value.trim(),
            address: document.getElementById("custAddress").value.trim(),
            notes: document.getElementById("custNotes").value.trim()
        };

        // The server checks stock, subtracts it, and works out the prices
        const { data, error } = await sb.rpc("place_order", {
            p_name: customer.name,
            p_phone: customer.phone,
            p_address: customer.address,
            p_notes: customer.notes,
            p_items: cart.map(item => ({
                product_id: item.productId,
                colour: item.colourName,
                size: item.size,
                quantity: item.quantity
            }))
        });

        if (error) throw new Error(error.message);

        const trackingLink =
            new URL(`track.html?order=${data.order_number}`, location.href).href;

        // Remember this order on the customer's device for the tracking page
        try {
            localStorage.setItem("africanEleganceLastOrder", JSON.stringify({
                order: data.order_number,
                phone: customer.phone
            }));
        } catch {
            // tracking still works by typing the details
        }

        const message =
            `*New Order ${data.order_number}*\n\n` +
            data.lines.join("\n") +
            `\n\n*Total: ${money(data.total)}*\n\n` +
            `Name: ${customer.name}\n` +
            `Phone: ${customer.phone}\n` +
            `Delivery: ${customer.address}` +
            (customer.notes ? `\nNotes: ${customer.notes}` : "") +
            `\n\nThis order is held for 2 hours until payment is confirmed.` +
            `\n\nTrack your order: ${trackingLink}`;

        const url =
            `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(message)}`;

        cart = [];
        saveCart();
        checkoutForm.reset();
        closeCart();

        await loadProducts();
        if (typeof refreshShopView === "function") refreshShopView();
        renderCart();

        if (whatsappTab) {
            whatsappTab.location.href = url;
        } else {
            window.location.href = url;
        }
    } catch (error) {
        if (whatsappTab) whatsappTab.close();
        alert(error.message || "Could not place the order. Please try again.");

        try {
            await loadProducts();
            if (typeof refreshShopView === "function") refreshShopView();
        } catch {
            // keep going
        }

        renderCart();
    } finally {
        placeButton.disabled = false;
        placeButton.textContent = "Place Order on WhatsApp";
    }
});

/* ================= START ================= */

updateCartCount();
cartItemsContainer.textContent =
    cart.length > 0 ? "Loading your cart..." : "Your cart is empty.";

// Other scripts wait for this before using the product list
const productsReady = loadProducts()
    .catch(error => {
        console.error(error);
        productsLoadFailed = true;
    })
    .then(() => renderCart());
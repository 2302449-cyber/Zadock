/* ===== House of Zadock: admin dashboard ===== */

const loginPanel = document.getElementById("loginPanel");
const loginForm = document.getElementById("loginForm");
const resetPanel = document.getElementById("resetPanel");
const newPasswordForm = document.getElementById("resetForm");
const dashboard = document.getElementById("dashboard");
const logoutButton = document.getElementById("logoutButton");

const productForm = document.getElementById("productForm");
const variantsContainer = document.getElementById("variantsContainer");
const addColourButton = document.getElementById("addColourButton");
const productList = document.getElementById("productList");
const orderList = document.getElementById("orderList");
const sizeTypeSelect = document.getElementById("sizeType");

const BUCKET = "product-images";

// Sizes (this file does not depend on any other file for them)
const ADMIN_SIZES = ["S", "M", "L", "XL", "XXL", "XXXL"];
const ONE = "ONE";
const ADMIN_SIZE_LABELS = {
    S: "Small (S)",
    M: "Medium (M)",
    L: "Large (L)",
    XL: "Extra Large (XL)",
    XXL: "XXL",
    XXXL: "XXXL",
    ONE: "One Size"
};

let products = [];
let orders = [];
let editingId = null;
let dashboardShown = false;

// True when the admin arrives from a password-reset email link
let recovering = location.hash.includes("type=recovery");

if (recovering) {
    loginPanel.hidden = true;
    resetPanel.hidden = false;
}

function sizeName(size) {
    return size === ONE ? "One Size" : size;
}

function productIsOneSize(product) {
    return (product?.colours || []).some(colour =>
        colour.stock && Object.prototype.hasOwnProperty.call(colour.stock, ONE)
    );
}

function currentSizes() {
    return sizeTypeSelect.value === "one" ? [ONE] : ADMIN_SIZES;
}

/* ================= LOGIN ================= */

loginForm.addEventListener("submit", async event => {
    event.preventDefault();

    const button = loginForm.querySelector('button[type="submit"]');
    button.disabled = true;

    const { error } = await sb.auth.signInWithPassword({
        email: document.getElementById("loginEmail").value.trim(),
        password: document.getElementById("loginPassword").value
    });

    button.disabled = false;

    if (error) {
        alert("Login failed: " + error.message);
        return;
    }

    loginForm.reset();
});

logoutButton.addEventListener("click", async () => {
    await sb.auth.signOut();
});

document.getElementById("forgotLink").addEventListener("click", async event => {
    event.preventDefault();

    const email = document.getElementById("loginEmail").value.trim();

    if (!email) {
        alert("Type your admin email in the Email box first, then click Forgot password.");
        return;
    }

    const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: location.origin + location.pathname
    });

    alert(error
        ? "Could not send the email: " + error.message
        : "If that email belongs to the admin, a reset link has been sent. Check your inbox and spam folder.");
});

newPasswordForm.addEventListener("submit", async event => {
    event.preventDefault();

    const button = newPasswordForm.querySelector("button");
    button.disabled = true;

    const { error } = await sb.auth.updateUser({
        password: document.getElementById("newPassword").value
    });

    button.disabled = false;

    if (error) {
        alert("Could not save the new password: " + error.message);
        return;
    }

    alert("Password changed. You are now logged in.");

    recovering = false;
    resetPanel.hidden = true;
    history.replaceState(null, "", location.pathname);

    const { data } = await sb.auth.getSession();
    applySession(data.session);
});

// Show the login box or the dashboard, only when the state really changes
async function applySession(session) {
    if (recovering) return;

    const shouldShow = Boolean(session);
    if (shouldShow === dashboardShown) return;

    dashboardShown = shouldShow;
    loginPanel.hidden = shouldShow;
    dashboard.hidden = !shouldShow;
    logoutButton.hidden = !shouldShow;

    if (shouldShow) {
        resetForm();
        await refreshAll();
    } else {
        products = [];
        orders = [];
        productList.replaceChildren();
        orderList.replaceChildren();
    }
}

sb.auth.getSession().then(({ data }) => applySession(data.session));

sb.auth.onAuthStateChange((_event, session) => {
    // setTimeout avoids a known Supabase freeze when calling it inside this callback
    setTimeout(() => applySession(session), 0);
});

/* ================= PHOTOS ================= */

// Shrink a photo to max 1200px so the shop stays fast on mobile data
async function compressImage(file, maxSize = 1200, quality = 0.85) {
    let bitmap;

    try {
        bitmap = await createImageBitmap(file);
    } catch {
        throw new Error(
            `"${file.name}" could not be read. Please use a JPG, PNG or WebP photo.`
        );
    }

    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");

    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    return new Promise((resolve, reject) => {
        canvas.toBlob(
            blob => blob ? resolve(blob) : reject(new Error("Could not process a photo.")),
            "image/jpeg",
            quality
        );
    });
}

// Upload one photo and return its public web address
async function uploadPhoto(productId, file) {
    const blob = await compressImage(file);
    const path = `${productId}/${crypto.randomUUID()}.jpg`;

    const { error } = await sb.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: "image/jpeg" });

    if (error) throw new Error("Photo upload failed: " + error.message);

    return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function photoPathFromUrl(url) {
    const marker = `/${BUCKET}/`;
    const index = url.indexOf(marker);
    return index === -1 ? null : url.slice(index + marker.length);
}

// Display photos and give each one its own Remove button
function renderPhotos(card) {
    const preview = card.querySelector(".photoPreview");
    preview.replaceChildren();

    card._images.forEach((item, index) => {
        const wrapper = document.createElement("div");
        wrapper.style.display = "inline-block";
        wrapper.style.margin = "5px";
        wrapper.style.verticalAlign = "top";

        const image = document.createElement("img");
        image.src = item.previewUrl || item.src;
        image.alt = "Product photo";
        image.style.width = "100px";
        image.style.height = "110px";
        image.style.objectFit = "cover";
        image.style.display = "block";

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "remove";
        removeButton.textContent = "Remove photo";
        removeButton.style.marginTop = "5px";

        removeButton.addEventListener("click", () => {
            const removed = card._images.splice(index, 1)[0];
            if (removed.previewUrl) URL.revokeObjectURL(removed.previewUrl);
            renderPhotos(card);
        });

        wrapper.append(image, removeButton);
        preview.appendChild(wrapper);
    });
}

/* ================= COLOUR SECTIONS AND SIZES ================= */

// Draw the stock boxes for the chosen size type, keeping numbers already typed
function buildStockGrid(card, values = {}) {
    const grid = card.querySelector(".size-grid");
    grid.replaceChildren();

    currentSizes().forEach(size => {
        const wrap = document.createElement("div");

        const label = document.createElement("label");
        label.textContent = ADMIN_SIZE_LABELS[size] || size;

        const input = document.createElement("input");
        input.type = "number";
        input.name = `stock${size}`;
        input.min = "0";
        input.step = "1";
        input.value = String(values[size] ?? 0);
        input.required = true;

        wrap.append(label, input);
        grid.appendChild(wrap);
    });
}

function readStockValues(card) {
    const values = {};

    card.querySelectorAll(".size-grid input").forEach(input => {
        values[input.name.replace("stock", "")] = Number(input.value) || 0;
    });

    return values;
}

// Switching between standard sizes and one size redraws every colour's stock boxes
sizeTypeSelect.addEventListener("change", () => {
    variantsContainer.querySelectorAll(".colour-card").forEach(card =>
        buildStockGrid(card, readStockValues(card)));
});

function createColourSection(colour = null) {
    const card = document.createElement("div");
    card.className = "colour-card";

    card.innerHTML = `
        <div style="display:flex; gap:10px; align-items:end;">
            <div style="flex:1;">
                <label>Colour Name</label>
                <input type="text" name="colourName" placeholder="e.g. Burgundy" required>
            </div>

            <button type="button" class="secondary addColourButton"
                title="Add another colour" style="margin:0; font-size:20px;">+</button>
        </div>

        <label>Pictures for this colour</label>

        <div style="display:flex; gap:10px; align-items:center;">
            <input type="file" name="colourImages" accept="image/jpeg,image/png,image/webp"
                multiple style="flex:1;">

            <button type="button" class="secondary addPictureButton"
                title="Add more pictures" style="margin:0; font-size:20px;">+</button>
        </div>

        <p class="help">
            Select pictures here. Use + to add more pictures
            without replacing the ones already selected.
        </p>

        <div class="photoPreview"></div>

        <h3>Available Stock for This Colour</h3>

        <div class="size-grid"></div>

        <button type="button" class="remove removeColourButton">
            Remove This Colour
        </button>
    `;

    const nameInput = card.querySelector('[name="colourName"]');
    const photoInput = card.querySelector('[name="colourImages"]');
    const pictureButton = card.querySelector(".addPictureButton");

    // Existing photos are web addresses; new photos are files waiting to upload
    card._images = colour
        ? colour.images.map(src => ({ src, file: null, previewUrl: null }))
        : [];

    if (colour) nameInput.value = colour.name;

    buildStockGrid(card, colour ? colour.stock : {});

    card.querySelector(".addColourButton").addEventListener("click", () => {
        createColourSection();
    });

    pictureButton.addEventListener("click", () => photoInput.click());

    photoInput.addEventListener("change", () => {
        for (const file of Array.from(photoInput.files)) {
            if (!file.type.startsWith("image/")) continue;

            card._images.push({
                file,
                src: null,
                previewUrl: URL.createObjectURL(file)
            });
        }

        photoInput.value = "";
        renderPhotos(card);
    });

    card.querySelector(".removeColourButton").addEventListener("click", () => {
        if (variantsContainer.children.length === 1) {
            alert("Keep at least one colour for this product.");
            return;
        }

        card._images.forEach(item => {
            if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        });

        card.remove();
    });

    variantsContainer.appendChild(card);
    renderPhotos(card);
}

addColourButton.addEventListener("click", () => createColourSection());

// Read the form (no uploading yet). Photos stay as files until saving.
function collectColours() {
    const cards = Array.from(variantsContainer.querySelectorAll(".colour-card"));
    const colours = [];

    for (const card of cards) {
        const name = card.querySelector('[name="colourName"]').value.trim();

        if (!name) throw new Error("Please enter every colour name.");

        if (card._images.length === 0) {
            throw new Error(`Please add at least one photo for ${name}.`);
        }

        const stock = {};

        for (const size of currentSizes()) {
            const quantity = Number(
                card.querySelector(`[name="stock${size}"]`).value
            );

            if (!Number.isInteger(quantity) || quantity < 0) {
                throw new Error("Stock must be a whole number of zero or more.");
            }

            stock[size] = quantity;
        }

        colours.push({ name, items: card._images, stock });
    }

    const names = colours.map(colour => colour.name.toLowerCase());

    if (new Set(names).size !== names.length) {
        throw new Error(
            "You have entered the same colour more than once. " +
            "Add all photos for that colour to its existing section."
        );
    }

    return colours;
}

/* ================= SAVE / LOAD PRODUCTS ================= */

async function loadProducts() {
    const { data, error } = await sb
        .from("products")
        .select("*, product_colours(*)")
        .order("created_at", { ascending: false });

    if (error) {
        alert("Could not load products: " + error.message);
        return;
    }

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
}

productForm.addEventListener("submit", async event => {
    event.preventDefault();

    const saveButton = productForm.querySelector('[type="submit"]');
    saveButton.disabled = true;
    saveButton.textContent = "Saving... please wait";

    try {
        const name = document.getElementById("productName").value.trim();
        const price = Number(document.getElementById("productPrice").value);
        const description = document.getElementById("productDescription").value.trim();

        if (!name || !description || !Number.isInteger(price) || price <= 0) {
            throw new Error("Enter a valid name, description and whole-number price.");
        }

        const colours = collectColours();
        const productId = editingId || crypto.randomUUID();

        // 1. Upload new photos and build the colour rows
        const rows = [];

        for (const [index, colour] of colours.entries()) {
            const images = [];

            for (const item of colour.items) {
                images.push(item.file
                    ? await uploadPhoto(productId, item.file)
                    : item.src);
            }

            rows.push({
                product_id: productId,
                name: colour.name,
                images,
                stock: colour.stock,
                position: index
            });
        }

        // 2. Save the product
        const { error: productError } = await sb
            .from("products")
            .upsert({ id: productId, name, price, description });

        if (productError) throw productError;

        // 3. Save the colours
        const { error: colourError } = await sb
            .from("product_colours")
            .upsert(rows, { onConflict: "product_id,name" });

        if (colourError) throw colourError;

        // 4. When editing, remove colours that were taken out of the form
        if (editingId) {
            const { data: existing, error: listError } = await sb
                .from("product_colours")
                .select("id, name")
                .eq("product_id", productId);

            if (listError) throw listError;

            const keep = new Set(rows.map(row => row.name));
            const removeIds = existing
                .filter(colour => !keep.has(colour.name))
                .map(colour => colour.id);

            if (removeIds.length > 0) {
                const { error: removeError } = await sb
                    .from("product_colours")
                    .delete()
                    .in("id", removeIds);

                if (removeError) throw removeError;
            }
        }

        await loadProducts();
        resetForm();
        renderProducts();

        alert("Product saved online successfully!");
    } catch (error) {
        alert(error.message || "The product could not be saved.");
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = editingId ? "Update Product" : "Save Product";
    }
});

function resetForm() {
    editingId = null;
    productForm.reset();
    sizeTypeSelect.value = "standard";
    variantsContainer.replaceChildren();
    createColourSection();

    productForm.querySelector('[type="submit"]').textContent = "Save Product";
}

function editProduct(id) {
    const product = products.find(item => item.id === id);
    if (!product) return;

    editingId = id;

    document.getElementById("productName").value = product.name;
    document.getElementById("productPrice").value = product.price;
    document.getElementById("productDescription").value = product.description;
    sizeTypeSelect.value = productIsOneSize(product) ? "one" : "standard";

    variantsContainer.replaceChildren();
    product.colours.forEach(colour => createColourSection(colour));

    productForm.querySelector('[type="submit"]').textContent = "Update Product";

    window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteProduct(id) {
    if (!confirm("Are you sure you want to delete this product?")) return;

    const product = products.find(item => item.id === id);

    const { error } = await sb.from("products").delete().eq("id", id);

    if (error) {
        alert("Could not delete: " + error.message);
        return;
    }

    // Also remove the product's photos from storage
    const paths = (product?.colours || [])
        .flatMap(colour => colour.images)
        .map(photoPathFromUrl)
        .filter(Boolean);

    if (paths.length > 0) {
        await sb.storage.from(BUCKET).remove(paths);
    }

    if (editingId === id) resetForm();

    await loadProducts();
    renderProducts();
}

/* ================= PRODUCT LIST ================= */

function renderProducts() {
    productList.replaceChildren();

    if (products.length === 0) {
        productList.textContent = "No products added yet.";
        return;
    }

    products.forEach(product => {
        const card = document.createElement("div");
        card.className = "product-card";

        const title = document.createElement("h3");
        title.textContent = product.name;

        const price = document.createElement("p");
        price.textContent = `KSh ${product.price.toLocaleString("en-KE")} per piece`;

        const description = document.createElement("p");
        description.textContent = product.description;

        card.append(title, price, description);

        product.colours.forEach(colour => {
            const heading = document.createElement("h4");
            heading.textContent = `Colour: ${colour.name}`;
            card.appendChild(heading);

            colour.images.forEach(src => {
                const image = document.createElement("img");
                image.src = src;
                image.alt = `${product.name} - ${colour.name}`;
                card.appendChild(image);
            });

            const stock = document.createElement("p");
            stock.textContent = [...ADMIN_SIZES, ONE]
                .filter(size => size in colour.stock)
                .map(size => `${sizeName(size)}: ${colour.stock[size]} pieces`)
                .join(" | ");

            card.appendChild(stock);
        });

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "secondary";
        editButton.textContent = "Edit Product";
        editButton.addEventListener("click", () => editProduct(product.id));

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "remove";
        deleteButton.style.marginLeft = "8px";
        deleteButton.textContent = "Delete Product";
        deleteButton.addEventListener("click", () => deleteProduct(product.id));

        card.append(editButton, deleteButton);
        productList.appendChild(card);
    });
}

/* ================= ORDERS ================= */

const STAGES = [
    ["placed", "Order Successful"],
    ["to_deliver", "To Be Delivered"],
    ["packaged", "Packaged"],
    ["on_the_way", "On the Way"],
    ["delivered", "Delivered"]
];

// Button for the next step of a paid order
const NEXT_STEP = {
    to_deliver: ["packaged", "Mark as Packaged"],
    packaged: ["on_the_way", "Mark as On the Way"],
    on_the_way: ["delivered", "Mark as Delivered"]
};

function stageLabel(key) {
    const found = STAGES.find(stage => stage[0] === key);
    return found ? found[1] : key;
}

// 0712345678 or +254712345678 becomes 254712345678 for WhatsApp links
function whatsappNumber(phone) {
    let digits = String(phone).replace(/\D/g, "");

    if (digits.startsWith("0")) digits = "254" + digits.slice(1);
    else if (digits.length === 9) digits = "254" + digits;

    return digits;
}

function stageMessage(order) {
    const link = new URL(`track.html?order=${order.order_number}`, location.href).href;

    const texts = {
        to_deliver: `your payment for order ${order.order_number} is confirmed and it is now scheduled for delivery.`,
        packaged: `your order ${order.order_number} has been packaged and is getting ready to leave.`,
        on_the_way: `your order ${order.order_number} is on the way to you.`,
        delivered: `your order ${order.order_number} has been delivered. Thank you for shopping with us!`
    };

    return `Hello ${order.customer_name}, ${texts[order.delivery_stage] || "here is an update on your order."}` +
        `\n\nTrack your order: ${link}`;
}

async function changeStage(orderId, stage) {
    const { error } = await sb.rpc("set_delivery_stage", {
        p_order_id: orderId,
        p_stage: stage
    });

    if (error) alert(error.message);

    await refreshAll();
}

async function loadOrders() {
    // Return the stock of any order unpaid for 2 hours
    await sb.rpc("release_expired_orders");

    const { data, error } = await sb
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        alert("Could not load orders: " + error.message);
        return;
    }

    orders = data;
}

async function refreshAll() {
    await loadProducts();
    await loadOrders();
    renderProducts();
    renderOrders();
}

function minutesLeft(order) {
    const expires = new Date(order.created_at).getTime() + 2 * 60 * 60 * 1000;
    return Math.max(0, Math.ceil((expires - Date.now()) / 60000));
}

function renderOrders() {
    orderList.replaceChildren();

    if (orders.length === 0) {
        orderList.textContent = "No orders yet.";
        return;
    }

    orders.forEach(order => {
        const card = document.createElement("div");
        card.className = "order-card";

        const title = document.createElement("h3");
        title.textContent = `Order ${order.order_number} `;

        const badge = document.createElement("span");
        badge.className = `status status-${order.status}`;
        badge.textContent = order.status.toUpperCase();
        title.appendChild(badge);

        const customer = document.createElement("p");
        customer.textContent =
            `${order.customer_name} | ${order.customer_phone} | ${order.customer_address}`;

        const items = document.createElement("p");
        items.style.whiteSpace = "pre-line";
        items.textContent = order.items
            .map(i => `• ${i.name} (${i.colour}, ${i.size === ONE ? "one size" : "size " + i.size}) x${i.quantity}`)
            .join("\n");

        const total = document.createElement("p");
        const bold = document.createElement("b");
        bold.textContent = `Total: KSh ${order.total.toLocaleString("en-KE")}`;
        total.appendChild(bold);

        const date = document.createElement("p");
        date.className = "help";
        date.textContent = new Date(order.created_at).toLocaleString("en-KE");

        card.append(title, customer, items, total);

        if (order.notes) {
            const notes = document.createElement("p");
            notes.textContent = `Notes: ${order.notes}`;
            card.appendChild(notes);
        }

        card.appendChild(date);

        if (order.status === "pending") {
            const timer = document.createElement("p");
            timer.className = "help";
            timer.textContent =
                `Stock is held for ${minutesLeft(order)} more minutes.`;

            const paidButton = document.createElement("button");
            paidButton.type = "button";
            paidButton.className = "primary";
            paidButton.textContent = "Mark as Paid";
            paidButton.addEventListener("click", async () => {
                paidButton.disabled = true;
                const { error } = await sb.rpc("mark_order_paid", { p_order_id: order.id });
                if (error) alert(error.message);
                await refreshAll();
            });

            const cancelButton = document.createElement("button");
            cancelButton.type = "button";
            cancelButton.className = "remove";
            cancelButton.style.marginLeft = "8px";
            cancelButton.textContent = "Cancel Order";
            cancelButton.addEventListener("click", async () => {
                if (!confirm("Cancel this order and return the stock?")) return;
                cancelButton.disabled = true;
                const { error } = await sb.rpc("cancel_order", { p_order_id: order.id });
                if (error) alert(error.message);
                await refreshAll();
            });

            card.append(timer, paidButton, cancelButton);
        }

        if (order.status === "paid") {
            const stage = document.createElement("p");
            const stageBadge = document.createElement("span");
            stageBadge.className = "status status-stage";
            stageBadge.textContent = stageLabel(order.delivery_stage);
            stage.append("Delivery: ", stageBadge);
            card.appendChild(stage);

            const next = NEXT_STEP[order.delivery_stage];

            if (next) {
                const nextButton = document.createElement("button");
                nextButton.type = "button";
                nextButton.className = "primary";
                nextButton.textContent = next[1];
                nextButton.addEventListener("click", () => {
                    nextButton.disabled = true;
                    changeStage(order.id, next[0]);
                });
                card.appendChild(nextButton);
            }

            const stageIndex = STAGES.findIndex(s => s[0] === order.delivery_stage);

            // One step back, in case a button was clicked by mistake
            if (stageIndex > 1) {
                const undoButton = document.createElement("button");
                undoButton.type = "button";
                undoButton.className = "remove";
                undoButton.style.marginLeft = "8px";
                undoButton.textContent = "Undo last step";
                undoButton.addEventListener("click", () => {
                    if (!confirm("Move this order one step back?")) return;
                    undoButton.disabled = true;
                    changeStage(order.id, STAGES[stageIndex - 1][0]);
                });
                card.appendChild(undoButton);
            }

            const messageLink = document.createElement("a");
            messageLink.href =
                `https://wa.me/${whatsappNumber(order.customer_phone)}?text=` +
                encodeURIComponent(stageMessage(order));
            messageLink.target = "_blank";
            messageLink.rel = "noopener";
            messageLink.textContent = "Message customer on WhatsApp";
            messageLink.style.cssText =
                "display:inline-block; margin:16px 0 0 8px; padding:12px 16px; " +
                "background:#25D366; color:#fff; border-radius:5px; " +
                "font-weight:bold; font-size:14px; text-decoration:none;";
            card.appendChild(messageLink);
        }

        orderList.appendChild(card);
    });
}

// Keep timers and expiries fresh while the dashboard is open.
// Skipped while a product is being edited so the form is not disturbed.
setInterval(() => {
    if (dashboardShown && !editingId && !recovering) refreshAll();
}, 60000);
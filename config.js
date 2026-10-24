// Supabase connection. The URL and publishable key are safe to put in website code.
// NEVER paste a "service_role" or "secret" key here.
const SUPABASE_URL = "https://migtkudikicgdepfwctl.supabase.co";
const SUPABASE_KEY = "sb_publishable_0K2YStxoe7SZGmR5VGaCOg_I0BWQRTz";

// "sb" is our connection to the online database, storage and login.
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Business details used on every page. Change them here, once.
const SITE = {
    name: "HOUSE OF ZADOCK",
    whatsapp: "254791214078",            // <-- YOUR number for practice
    phone: "+254 791 214 078",
    email: "hello@homeofzadock.com",
    location: "Nairobi, Kenya", 
    instagram: "",                       // paste a full link, or leave empty
    tiktok: ""
};
// ===== Sizes (used by the shop) =====
const SIZE_LIST = ["S", "M", "L", "XL", "XXL", "XXXL"];
const ONE_SIZE = "ONE";

const SIZE_LABELS = {
    S: "Small (S)",
    M: "Medium (M)",
    L: "Large (L)",
    XL: "Extra Large (XL)",
    XXL: "XXL",
    XXXL: "XXXL",
    ONE: "One Size"
};

// A product is "one size" when its stock is kept under the ONE key
function isOneSize(product) {
    return (product?.colours || []).some(colour =>
        colour.stock && Object.prototype.hasOwnProperty.call(colour.stock, ONE_SIZE)
    );
}

function sizesFor(product) {
    return isOneSize(product) ? [ONE_SIZE] : SIZE_LIST;
}

function sizeText(size) {
    return size === ONE_SIZE ? "One Size" : size;
}
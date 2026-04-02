const productCatalog = Array.isArray(window.productCatalog) ? window.productCatalog : [];

function getCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem("sarmartha-cart"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem("sarmartha-cart", JSON.stringify(cart));
}

function cartCount(cart = getCart()) {
  return cart.reduce((sum, item) => sum + item.qty, 0);
}

function cartSubtotal(cart = getCart()) {
  return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}

function formatPrice(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value);
}

function getProductById(productId) {
  return productCatalog.find((product) => product.id === productId);
}

function addToCart(productId) {
  const product = getProductById(productId);
  if (!product) {
    return;
  }

  const cart = getCart();
  const existing = cart.find((item) => item.id === product.id);

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      telugu: product.telugu,
      rate: product.rate,
      price: product.price,
      image: product.image,
      unit: product.unit,
      qty: 1
    });
  }

  saveCart(cart);
  syncCartCount();
  window.alert(`${product.name} added to cart.`);
}

function updateCartItem(productId, nextQty) {
  const cart = getCart();
  const item = cart.find((entry) => entry.id === productId);
  if (!item) {
    return;
  }

  item.qty = Math.max(1, nextQty);
  saveCart(cart);
  syncCartCount();
}

function removeFromCart(productId) {
  const nextCart = getCart().filter((item) => item.id !== productId);
  saveCart(nextCart);
  syncCartCount();
}

function syncCartCount() {
  document.querySelectorAll("[data-cart-count]").forEach((node) => {
    node.textContent = cartCount();
  });
}

function renderProducts() {
  const host = document.getElementById("product-grid");
  if (!host) {
    return;
  }

  const requestedLimit = Number.parseInt(host.dataset.limit || "", 10);
  const visibleProducts = Number.isFinite(requestedLimit) && requestedLimit > 0
    ? productCatalog.slice(0, requestedLimit)
    : productCatalog;

  host.innerHTML = visibleProducts.map((product, index) => `
    <article class="product-card fade-up delay-${Math.min(index, 3)}">
      <div class="product-media">
        <span class="product-badge">${product.badge}</span>
        <img src="${product.image}" alt="${product.name}">
      </div>
      <div class="product-body">
        <h3>${product.name}</h3>
        <p>${product.telugu}</p>
        <p>${product.description}</p>
        <div class="price-row">
          <div>
            <div class="price">${formatPrice(product.price)}</div>
            <small>${product.unit}</small>
          </div>
          <button class="button" type="button" onclick="addToCart('${product.id}')">Add to Cart</button>
        </div>
      </div>
    </article>
  `).join("");
}

function renderCartPage() {
  const list = document.getElementById("cart-list");
  const subtotalNode = document.getElementById("cart-subtotal");
  const totalNode = document.getElementById("cart-total");
  const countNode = document.getElementById("cart-item-count");
  const emptyNode = document.getElementById("cart-empty");
  const panelNode = document.getElementById("cart-panel");
  if (!list || !subtotalNode || !totalNode || !countNode || !emptyNode || !panelNode) {
    return;
  }

  const cart = getCart();
  const subtotal = cartSubtotal(cart);

  countNode.textContent = `${cartCount(cart)} items`;
  subtotalNode.textContent = formatPrice(subtotal);
  totalNode.textContent = formatPrice(subtotal);

  if (!cart.length) {
    emptyNode.hidden = false;
    panelNode.hidden = true;
    return;
  }

  emptyNode.hidden = true;
  panelNode.hidden = false;

  list.innerHTML = cart.map((item) => `
    <article class="cart-item">
      <img class="cart-thumb" src="${item.image}" alt="${item.name}">
      <div>
        <h3>${item.name}</h3>
        <p>${item.telugu}</p>
        <p>${item.unit}</p>
        <p>Rate ${formatPrice(item.price)}</p>
        <div class="qty-control">
          <button class="qty-button" type="button" onclick="changeQty('${item.id}', -1)">-</button>
          <span class="qty-number">${item.qty}</span>
          <button class="qty-button" type="button" onclick="changeQty('${item.id}', 1)">+</button>
        </div>
      </div>
      <div class="item-total">
        <strong>${formatPrice(item.price * item.qty)}</strong>
        <p>${formatPrice(item.price)} each</p>
        <button class="button-outline" type="button" onclick="removeItemAndRender('${item.id}')">Remove</button>
      </div>
    </article>
  `).join("");
}

function changeQty(productId, delta) {
  const item = getCart().find((entry) => entry.id === productId);
  if (!item) {
    return;
  }

  updateCartItem(productId, item.qty + delta);
  renderCartPage();
}

function removeItemAndRender(productId) {
  removeFromCart(productId);
  renderCartPage();
}

function populateCheckoutSummary() {
  const summary = document.getElementById("checkout-summary");
  const totalNode = document.getElementById("checkout-total");
  const checkoutButton = document.getElementById("place-order-button");
  if (!summary || !totalNode || !checkoutButton) {
    return;
  }

  const cart = getCart();
  const subtotal = cartSubtotal(cart);
  totalNode.textContent = formatPrice(subtotal);

  if (!cart.length) {
    summary.innerHTML = "<p>Your cart is empty. Please add products before checkout.</p>";
    checkoutButton.disabled = true;
    checkoutButton.textContent = "Cart Empty";
    return;
  }

  summary.innerHTML = cart.map((item) => `
    <div class="summary-line">
      <span>${item.name} x ${item.qty}</span>
      <strong>${formatPrice(item.price * item.qty)}</strong>
    </div>
  `).join("");
}

function handleCheckout(event) {
  event.preventDefault();
  const cart = getCart();
  if (!cart.length) {
    window.alert("Your cart is empty.");
    return;
  }

  const form = event.currentTarget;
  const customerName = form.querySelector("[name='customerName']").value.trim();
  const orderId = `SSS-${Date.now().toString().slice(-6)}`;

  localStorage.removeItem("sarmartha-cart");
  syncCartCount();

  window.alert(`Thank you, ${customerName}. Your order ${orderId} has been placed successfully.`);
  window.location.href = "index.html";
}

document.addEventListener("DOMContentLoaded", () => {
  syncCartCount();
  renderProducts();
  renderCartPage();
  populateCheckoutSummary();
});

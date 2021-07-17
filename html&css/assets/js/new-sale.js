const AutoComplete = require('@tarekraafat/autocomplete.js');
const Database = require('better-sqlite3');
const $ = require('jquery');
const swal = require('sweetalert');
const validator = require('email-validator');
const { app, getCurrentWindow } = require('electron').remote;
const path = require('path');

const databasePath = path.join(app.getAppPath('userData').replace('app.asar', ''), 'western-data.db');
const salesTotalPrice = document.getElementById('total-price');
const salesProductCount = document.getElementById('item-count');

/**
 * Get all product names from the database
 * @returns {Array} An array containing the names of all products in the product table
 */
function getProducts() {
  const db = new Database(databasePath, { verbose: console.log });
  const products = [];
  try {
    db.prepare('SELECT name FROM product').all().forEach((row) => {
      products.push(row.name);
    });
  } catch (err) {
    // swal("Oops", 'An error occured while getting the products from the database', "error");
    swal("Oops", err.message, "error");
  }
  db.close();
  return products;
}

/**
 * Get the details of the product with matching name from the product table
 * @param {string} productName name of the product to get details
 */
function getDetails(productName) {
  const db = new Database(databasePath, { verbose: console.log });
  try {
    return db.prepare('SELECT id, quantity, selling_price, cost_price FROM product WHERE name = ?').get(productName);
  } catch (err) {
    swal("Oops", err.message, "error");
  }
  db.close();
  return { quantity: 0, selling_price: 0 };
}

/**
 * Update product total price and sales total price when any quantity field is edited
 */
function processQuantity() {
  const allProductContainers = document.getElementsByClassName('product-popup');
  salesProductCount.value = allProductContainers.length;
  let total = 0;
  let totPriceTemp = 0;
  for (const productPopup of allProductContainers) {
    const productUnitCostField = productPopup.querySelector('#product-unit-cost');
    const productTotalCostField = productPopup.querySelector('#product-total-price');
    const productQuantityField = productPopup.querySelector('#product-quantity');
    // Handle max quantity
    if (parseInt(productQuantityField.value, 10)
      > parseInt(productQuantityField.getAttribute('max'), 10)) {
      productQuantityField.value = productQuantityField.getAttribute('max');
    }

    if (parseInt(productQuantityField.value, 10) > 0) {
      totPriceTemp = parseInt(productUnitCostField.value, 10)
        * parseInt(productQuantityField.value, 10);
      productTotalCostField.value = totPriceTemp;
      total += totPriceTemp;
    }
  }
  salesTotalPrice.value = total;
}

/**
 * Remove product popup from the page
 */
function removeProduct(event) {
  const parentElement = $(event.target).parent();
  parentElement.remove();
  processQuantity();
}

function createProduct(id, maxQuantity, unitPrice, productName, revenue) {
  const productElement = `
    <div class="row card py-3 mb-3 m-auto product-popup">
      <div class="col-12 mb-4">
        <div class="form-group">
          <label for="product-name">Product Name</label>
          <input class="form-control" id="product-name" type="text" placeholder="Product Name" required
            disabled value='${productName}'>
          <div class="invalid-feedback">
            Enter product name
          </div>
        </div>
      </div>

      <div class="row m-auto">
        <div class="col-md-4 mb-4">
          <div class="form-group">
            <label for="product-price">Price</label>
            <input class="form-control" id="product-unit-cost" type="text" placeholder="Product Price" value="${unitPrice}" disabled>
          </div>
        </div>
        <div class="col-md-4 mb-4">
          <div class="form-group">
            <label for="quantity">Quantity</label>
            <input class="form-control" id="product-quantity" type="number" placeholder="Quantity" max="${maxQuantity}" min="1" value="1"
              oninput="processQuantity()" required>
            <div class="invalid-feedback">
              Enter product Quantity
            </div>
          </div>
        </div>
        <div class="col-md-4 mb-4">
          <div class="form-group">
            <label for="total-price">Total Price</label>
            <input class="form-control" id="product-total-price" type="text" placeholder="Total Price" required
              disabled>
          </div>
        </div>
      </div>
      <input type="hidden" id="saleProductId" value="${id}">
      <input type="hidden" id="saleProductRevenue" value="${revenue}">
      <button class="btn btn-danger mt-2 animate-up-2 m-auto" id="remove-product-button" style="width: 50%;" onclick="removeProduct(event)">
        Remove Product
      </button>
    </div>
  `;
  $('#product-popup-container').append(productElement);
}

const autoCompleteJS = new AutoComplete({
  placeHolder: "Search for Products...",
  data: {
    src: getProducts(),
  },
  resultItem: {
    highlight: {
      render: true.valueOf,
    },
  },
  events: {
    input: {
      selection: (event) => {
        const selection = event.detail.selection.value;
        autoCompleteJS.input.value = selection;
        const productDetails = getDetails(selection);
        createProduct(productDetails.id, productDetails.quantity, productDetails.selling_price,
          selection, productDetails.selling_price - productDetails.cost_price);
        processQuantity();
      },
    },
  },
});

document.querySelector("#autoComplete").addEventListener("click", () => {
  autoCompleteJS.input.value = '';
});

function validatePhoneNumber(phoneNumber) {
  if (phoneNumber.length === 11 && phoneNumber.match(/^[0-9]+$/)) {
    return true;
  } else {
    return false;
  }
}

function getId() {
  return JSON.parse(window.localStorage.getItem('auth')).id;
}

function validateSaleWindow(customerContactField, customerNameField, ItemCountField) {
  if (validator.validate(customerContactField.value)
    || validatePhoneNumber(customerContactField.value)) {
    customerContactField.classList.remove('is-invalid');
  } else {
    customerContactField.classList.add('is-invalid');
    return false;
  }

  if (customerNameField.value.length > 1) {
    customerNameField.classList.remove('is-invalid');
  } else {
    customerNameField.classList.add('is-invalid');
    return false;
  }

  if (parseInt(ItemCountField.value, 10) > 0) {
    ItemCountField.classList.remove('is-invalid');
  } else {
    ItemCountField.classList.add('is-invalid');
    return false;
  }
  return true;
}

function updateProductQuantities(productDetails) {
  const db = new Database(databasePath, { verbose: console.log });
  try {
    const productsQuery = db.prepare(`UPDATE PRODUCT SET quantity = quantity - @quantity WHERE id = @id`);
    const updateMany = db.transaction((variables) => {
      for (const variable of variables) productsQuery.run(variable);
    });
    updateMany(productDetails);
  } catch (error) {
    swal("Oops", error.message, "error");
  }
}

function saveItems(saleId) {
  const db = new Database(databasePath, { verbose: console.log });
  let totalRevenue = 0;
  try {
    const ItemsQuery = db.prepare(`INSERT INTO sales_item (product_name, unit_cost, quantity, total_cost,
      sale, product) VALUES(@product_name, @unit_cost, @quantity, @total_cost, @sale, @product)`);
    const insertMany = db.transaction((variables) => {
      for (const variable of variables) ItemsQuery.run(variable);
    });

    const queryParameters = [];
    const updateParameters = [];

    const allProductContainers = document.getElementsByClassName('product-popup');
    for (const productPopup of allProductContainers) {
      if (parseInt(productPopup.querySelector('#product-quantity').value, 10) > 0
        && parseInt(productPopup.querySelector('#product-unit-cost').value, 10) > 0) {
        queryParameters.push({
          product_name: productPopup.querySelector('#product-name').value,
          unit_cost: productPopup.querySelector('#product-unit-cost').value,
          quantity: productPopup.querySelector('#product-quantity').value,
          total_cost: productPopup.querySelector('#product-total-price').value,
          sale: saleId,
          product: productPopup.querySelector('#saleProductId').value,
        });
        updateParameters.push({
          quantity: productPopup.querySelector('#product-quantity').value,
          id: productPopup.querySelector('#saleProductId').value,
        });
      }
      totalRevenue += parseInt(productPopup.querySelector('#saleProductRevenue').value, 10)
        * parseInt(productPopup.querySelector('#product-quantity').value, 10);
    }

    insertMany(queryParameters);
    updateProductQuantities(updateParameters);
  } catch (err) {
    swal("Oops", err.message, "error");
  }
  db.close();
  return totalRevenue;
}

function incrementUserSales(userId) {
  const db = new Database(databasePath, { verbose: console.log });
  try {
    db.prepare(`UPDATE auth SET total_sales = total_sales + 1 WHERE id = ?`).run(userId);
  } catch (err) {
    swal("Oops", err.message, "error");
  }
}

document.getElementById('complete-sale').addEventListener('click', () => {
  const customerNameField = document.getElementById('customer-name');
  const paymentMethodField = document.getElementById('payment-method');
  const customerContactField = document.getElementById('customer-contact');
  let saleId;

  if (validateSaleWindow(customerContactField, customerNameField, salesProductCount)) {
    // Save Sales
    const db = new Database(databasePath, { verbose: console.log });
    try {
      const salesRow = db.prepare(`INSERT INTO sales (customer_name, purchase_time, total_price,
          total_revenue, payment_method, sales_rep, customer_contact) VALUES(?, 
          datetime('now'), ?, ?, ?, ?, ?)`)
        .run(customerNameField.value, salesTotalPrice.value, 0, paymentMethodField.value,
          getId(), customerContactField.value);
      saleId = salesRow.lastInsertRowid;
    } catch (err) {
      swal("Oops", err.message, "error");
    }
    db.close();
    // Save Sales Items
    const saleRevenue = saveItems(saleId);
    console.log(saleRevenue);
    if (saleRevenue > 0) {
      const dbRevenue = new Database(databasePath, { verbose: console.log });
      try {
        dbRevenue.prepare(`UPDATE sales SET total_revenue = ? WHERE id = ?`).run(saleRevenue, saleId);
        incrementUserSales(JSON.parse(window.localStorage.getItem('auth')).id);
        swal("Success!", 'New sale saved to the database', "success")
          .then(() => {
            getCurrentWindow().reload();
          });
      } catch (err) {
        swal("Oops", err.message, "error");
      }
      dbRevenue.close();
    }
  } else {
    swal("Error!", 'Ensure allfields are filled', "error");
  }
});

window.onload = () => {
  // Display Name
  try {
    document.getElementById('full-name').textContent = JSON.parse(window.localStorage.getItem('auth')).name;
  } catch (err) {
    console.log('Auth Element missing please login');
  }

  // Hide Elements from non admin users
  const isAdmin = JSON.parse(window.localStorage.getItem('auth')).admin;
  if (`${isAdmin}` === '0') {
    const adminOnlyElements = document.getElementsByClassName('d-none admin-only-button');
    for (const adminAlone of adminOnlyElements) {
      adminAlone.classList.add('d-none');
    }
  }
};

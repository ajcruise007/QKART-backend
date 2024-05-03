const httpStatus = require("http-status");
const { Cart, Product } = require("../models");
const ApiError = require("../utils/ApiError");
const config = require("../config/config");


/**
 * Fetches cart for a user
 * - Fetch user's cart from Mongo
 * - If cart doesn't exist, throw ApiError
 * --- status code  - 404 NOT FOUND
 * --- message - "User does not have a cart"
 *
 * @param {User} user
 * @returns {Promise<Cart>}
 * @throws {ApiError}
 */
const getCartByUser = async (user) => {
  try {
    let cart = await Cart.findOne({ email: user.email });
    if (!cart) {
      throw new ApiError(httpStatus.NOT_FOUND, "User does not have a cart");
    }
    return cart;
  } catch (error) {
    return error;
  }
};

/**
 * Adds a new product to cart
 * - Get user's cart object using "Cart" model's findOne() method
 * --- If it doesn't exist, create one
 * --- If cart creation fails, throw ApiError with "500 Internal Server Error" status code
 *
 * - If product to add already in user's cart, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "Product already in cart. Use the cart sidebar to update or remove product from cart"
 *
 * - If product to add not in "products" collection in MongoDB, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "Product doesn't exist in database"
 *
 * - Otherwise, add product to user's cart
 *
 *
 *
 * @param {User} user
 * @param {string} productId
 * @param {number} quantity
 * @returns {Promise<Cart>}
 * @throws {ApiError}
 */
const addProductToCart = async (user, productId, quantity) => {
  let product = await Product.findById(productId);

  let cart = await Cart.findOne({ email: user.email });

  try {
    if (!cart) {
      cart = await Cart.create({
        email: user.email,
        cartItems: [],
      });
      
    }

    
  } catch (error) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR);
  }

  let exist = false;
    cart.cartItems.forEach((obj) => {
      if (obj.product._id.toString() === productId.toString()) {
        exist = true;
      }
      
    });

    if (exist) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Product already in cart. Use the cart sidebar to update or remove product from cart"
      );
    }

    // If product to add is not in products db
    if (!product) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Product doesn't exist in database"
      );
    }

    // add the product to the cart
    cart.cartItems.push({
      product: product,
      quantity: quantity,
    });
    await cart.save();
    return cart;

  // If product is already there in user's cart
  // let exists = cart.cartItems.find(obj => {
  //   console.log( obj.product._id.toString() === productId.toString())
  //   return obj.product._id.toString() === productId.toString();
  // })
};

/**
 * Updates the quantity of an already existing product in cart
 * - Get user's cart object using "Cart" model's findOne() method
 * - If cart doesn't exist, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "User does not have a cart. Use POST to create cart and add a product"
 *
 * - If product to add not in "products" collection in MongoDB, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "Product doesn't exist in database"
 *
 * - If product to update not in user's cart, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "Product not in cart"
 *
 * - Otherwise, update the product's quantity in user's cart to the new quantity provided
 *
 *
 * @param {User} user
 * @param {string} productId
 * @param {number} quantity
 * @returns {Promise<Cart>
 * @throws {ApiError}
 */
const updateProductInCart = async (user, productId, quantity) => {
  let cart = await Cart.findOne({ email: user.email });
  // if cart doesnt exists
  if (!cart) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "User does not have a cart. Use POST to create cart and add a product"
    );
  }

  // if product to add is not in db
  let product = await Product.findOne({ _id: productId });
  if (!product) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Product doesn't exist in database"
    );
  }

  // if product is not in user's cart
  let exists = cart.cartItems.find((obj) => obj.product._id.toString() === productId.toString());
  if (!exists) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Product not in cart");
  }

  // Finally update product's quantity in user's cart
  cart.cartItems.forEach((obj) => {
    if (obj.product._id.toString() === productId.toString()) {
      obj.quantity = quantity;
    }
  });
  await cart.save();
  return cart;
};

/**
 * Deletes an already existing product in cart
 * - If cart doesn't exist for user, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "User does not have a cart"
 *
 * - If product to update not in user's cart, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "Product not in cart"
 *
 * Otherwise, remove the product from user's cart
 *
 *
 * @param {User} user
 * @param {string} productId
 * @throws {ApiError}
 */
const deleteProductFromCart = async (user, productId) => {
    let cart = await Cart.findOne({email: user.email});
    if(!cart) {
      throw new ApiError (httpStatus.BAD_REQUEST, "User does not have a cart");
    }

    let exists = false, pos = 0;
    console.log(cart.cartItems)
    cart.cartItems.forEach((obj, index) => {
      if(obj.product._id.equals(productId)) {
        exists = true;
        pos = index;
      }
    });

    if(exists === false) {
      throw new ApiError (httpStatus.BAD_REQUEST, "Product not in cart");
    }

    // remove the product from cart
    cart.cartItems.splice(pos, 1);
    await cart.save();
};

// TODO: CRIO_TASK_MODULE_TEST - Implement checkout function
/**
 * Checkout a users cart.
 * On success, users cart must have no products.
 *
 * @param {User} user
 * @returns {Promise}
 * @throws {ApiError} when cart is invalid
 */
const checkout = async (user) => {
  let cart = await Cart.findOne({email: user.email});
  if(!cart) {
    throw new ApiError(httpStatus.NOT_FOUND, "Cart not found");
  }

  if(cart.cartItems.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "No products in cart")
  }

  if(!await user.hasSetNonDefaultAddress()) {
    throw new ApiError(httpStatus.BAD_REQUEST, "No valid address");
  }


  let walletMoney = user.walletMoney;
  let total = 0;
  cart.cartItems.forEach(obj => {
      total = total + (obj.product.cost * obj.quantity);
  });
  let finalBalance = walletMoney - total;
  if(finalBalance < 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Insufficient balance");
  }
  user.walletMoney = finalBalance;
  await user.save();
  cart.cartItems = [];
  await cart.save();
  return cart;
};

module.exports = {
  getCartByUser,
  addProductToCart,
  updateProductInCart,
  deleteProductFromCart,
  checkout,
};

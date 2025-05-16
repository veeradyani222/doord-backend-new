{localStorage.getItem('auth-token') ? (
    <li className='login' onClick={() => setIsLogoutModalOpen(true)}>Logout</li>
  ) : (
    <Link to="/login">
      <li className='login'>Login</li>
    </Link>
  )}

  <div className="cart profile" onClick={() => checkAuthentication('/profile')}>
    <li className='profile'>
      <img src={user_icon} alt="User" />
    </li>
  </div>

  <div className="cart" onClick={() => checkAuthentication('/wishlist')}>
    <div className="cart-wishlist-number">{totalWishlistItems}</div>
    <li className='wishlist'>
      <img src={heart_icon} alt="Wishlist" />
    </li>
  </div>

  <div className="cart shopcart" onClick={() => checkAuthentication('/cart')}>
    <div className="cart-cart-number">{totalCartItems}</div>
    <li className='cart shopcart'>
      <img src={cart_icon} alt="Cart" />
    </li>
  </div>
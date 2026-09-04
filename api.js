// ==========================================================
// 📡 FLAMMES CENTRAL API LIBRARY — v2.1
// Powers: Super Admin | Shop Owner | Worker | Agent | Customer
// Auth: Firebase Auth | Database: Firestore
// ==========================================================

class FlammesAPI {
  constructor() {
    this.db = firebase.firestore();
    this.auth = firebase.auth();
    this.currentUser = null;
    this.userData = null;
    this.shopId = null;
    this.role = null;
    this.initialized = false;
  }

  // ======================================================
  // 🔐 INITIALIZE & AUTHENTICATION — ALL ROLES
  // ======================================================
  async init() {
    if (this.initialized) return this.userData;
    
    return new Promise((resolve, reject) => {
      this.auth.onAuthStateChanged(async (user) => {
        if (!user) {
          this.initialized = true;
          return resolve(null);
        }
        
        this.currentUser = user;
        const userDoc = await this.db.collection('users').doc(user.uid).get();
        
        if (!userDoc.exists) {
          this.initialized = true;
          return resolve(null);
        }
        
        this.userData = { uid: user.uid, email: user.email, ...userDoc.data() };
        this.shopId = this.userData.shopId || null;
        this.role = this.userData.role;
        this.initialized = true;
        
        localStorage.setItem('flammes_user_role', this.role);
        localStorage.setItem('flammes_shopId', this.shopId || '');
        localStorage.setItem('flammes_user_email', user.email);
        
        resolve(this.userData);
      });
    });
  }

  async requireRole(allowedRoles) {
    await this.init();
    if (!this.currentUser) {
      window.location.href = 'login.html';
      throw new Error('Not authenticated');
    }
    if (!allowedRoles.includes(this.role)) {
      alert('❌ Access Denied — Insufficient permissions');
      await this.logout();
      throw new Error(`Role "${this.role}" not allowed here`);
    }
    return true;
  }

  async logout() {
    await this.auth.signOut();
    localStorage.removeItem('flammes_user_role');
    localStorage.removeItem('flammes_shopId');
    localStorage.removeItem('flammes_user_email');
    localStorage.removeItem('flammes_admin_authed');
    this.currentUser = null;
    this.userData = null;
    this.shopId = null;
    this.role = null;
    this.initialized = false;
    window.location.href = 'login.html';
  }

  // ======================================================
  // 👑 SUPER ADMIN METHODS — role: superadmin
  // ======================================================
  async getAllShops() {
    await this.requireRole(['superadmin']);
    const snap = await this.db.collection('shops').orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async getAllUsers() {
    await this.requireRole(['superadmin']);
    const snap = await this.db.collection('users').orderBy('createdAt', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async createShop(shopData, ownerEmail) {
    await this.requireRole(['superadmin']);
    const ref = await this.db.collection('shops').add({
      ...shopData,
      ownerEmail,
      status: 'active',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  }

  async updateShop(shopId, data) {
    await this.requireRole(['superadmin']);
    await this.db.collection('shops').doc(shopId).update({
      ...data,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  }

  async deleteShop(shopId) {
    await this.requireRole(['superadmin']);
    await this.db.collection('shops').doc(shopId).update({
      status: 'deleted',
      deletedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  }

  async getPlatformStats() {
    await this.requireRole(['superadmin']);
    const [shops, users, orders, products] = await Promise.all([
      this.db.collection('shops').where('status', '==', 'active').get(),
      this.db.collection('users').get(),
      this.db.collection('orders').get(),
      this.db.collection('products').get()
    ]);
    return {
      totalShops: shops.size,
      totalUsers: users.size,
      totalOrders: orders.size,
      totalProducts: products.size,
      totalRevenue: orders.docs.reduce((sum, o) => sum + (o.data().total || 0), 0)
    };
  }

  async setUserRole(uid, role, shopId = null) {
    await this.requireRole(['superadmin']);
    await this.db.collection('users').doc(uid).update({
      role,
      shopId,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  }

  // ======================================================
  // 🏪 SHOP OWNER METHODS — role: shop_owner
  // ======================================================
  async getMyShop() {
    await this.requireRole(['shop_owner', 'superadmin']);
    if (!this.shopId) throw new Error('No shop assigned to your account');
    const doc = await this.db.collection('shops').doc(this.shopId).get();
    if (!doc.exists) throw new Error('Shop not found');
    return { id: doc.id, ...doc.data() };
  }

  async updateMyShop(data) {
    await this.requireRole(['shop_owner', 'superadmin']);
    if (!this.shopId) throw new Error('No shop assigned');
    await this.db.collection('shops').doc(this.shopId).update({
      ...data,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  }

  // 👷 WORKER MANAGEMENT
  async addWorker(workerData) {
    await this.requireRole(['shop_owner', 'superadmin']);
    if (!this.shopId) throw new Error('No shop assigned');
    const ref = await this.db.collection('users').add({
      ...workerData,
      role: 'shop_worker',
      shopId: this.shopId,
      isActive: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  }

  async getWorkers() {
    await this.requireRole(['shop_owner', 'superadmin']);
    if (!this.shopId) return [];
    const snap = await this.db.collection('users')
      .where('shopId', '==', this.shopId)
      .where('role', '==', 'shop_worker')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async updateWorker(uid, data) {
    await this.requireRole(['shop_owner', 'superadmin']);
    await this.db.collection('users').doc(uid).update({
      ...data,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  }

  async deactivateWorker(uid) {
    await this.requireRole(['shop_owner', 'superadmin']);
    await this.db.collection('users').doc(uid).update({
      isActive: false,
      deactivatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  }

  // 🤝 AGENT MANAGEMENT
  async addAgent(agentData) {
    await this.requireRole(['shop_owner', 'superadmin']);
    if (!this.shopId) throw new Error('No shop assigned');
    const ref = await this.db.collection('users').add({
      ...agentData,
      role: 'agent',
      shopId: this.shopId,
      totalEarnings: 0,
      totalReferrals: 0,
      isActive: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  }

  async getAgents() {
    await this.requireRole(['shop_owner', 'superadmin']);
    if (!this.shopId) return [];
    const snap = await this.db.collection('users')
      .where('shopId', '==', this.shopId)
      .where('role', '==', 'agent')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async updateAgent(uid, data) {
    await this.requireRole(['shop_owner', 'superadmin']);
    await this.db.collection('users').doc(uid).update({
      ...data,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  }

  async deactivateAgent(uid) {
    await this.requireRole(['shop_owner', 'superadmin']);
    await this.db.collection('users').doc(uid).update({ isActive: false });
    return true;
  }

  // 📊 SHOP STATS
  async getMyShopStats() {
    await this.requireRole(['shop_owner', 'superadmin', 'shop_worker']);
    if (!this.shopId) return null;
    const [products, orders, customers] = await Promise.all([
      this.db.collection('products').where('shopId', '==', this.shopId).get(),
      this.db.collection('orders').where('shopId', '==', this.shopId).get(),
      this.db.collection('customers').where('shopId', '==', this.shopId).get()
    ]);
    return {
      totalProducts: products.size,
      totalOrders: orders.size,
      totalCustomers: customers.size,
      totalRevenue: orders.docs.reduce((sum, o) => sum + (o.data().total || 0), 0)
    };
  }

  // ======================================================
  // 👷 SHOP WORKER METHODS — role: shop_worker
  // ======================================================
  async getProducts() {
    await this.requireRole(['shop_owner', 'superadmin', 'shop_worker']);
    if (!this.shopId) return [];
    const snap = await this.db.collection('products')
      .where('shopId', '==', this.shopId)
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async addProduct(productData) {
    await this.requireRole(['shop_owner', 'superadmin', 'shop_worker']);
    if (!this.shopId) throw new Error('No shop assigned');
    const ref = await this.db.collection('products').add({
      ...productData,
      shopId: this.shopId,
      addedBy: this.currentUser.uid,
      isActive: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  }

  async updateProduct(productId, data) {
    await this.requireRole(['shop_owner', 'superadmin', 'shop_worker']);
    await this.db.collection('products').doc(productId).update({
      ...data,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  }

  async deleteProduct(productId) {
    await this.requireRole(['shop_owner', 'superadmin']);
    await this.db.collection('products').doc(productId).update({
      isActive: false,
      deletedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  }

  async getOrders(status = null) {
    await this.requireRole(['shop_owner', 'superadmin', 'shop_worker']);
    if (!this.shopId) return [];
    let query = this.db.collection('orders').where('shopId', '==', this.shopId);
    if (status) query = query.where('status', '==', status);
    const snap = await query.orderBy('createdAt', 'desc').limit(100).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async updateOrderStatus(orderId, status) {
    await this.requireRole(['shop_owner', 'superadmin', 'shop_worker']);
    await this.db.collection('orders').doc(orderId).update({
      status,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return true;
  }

  async getCustomers() {
    await this.requireRole(['shop_owner', 'superadmin', 'shop_worker']);
    if (!this.shopId) return [];
    const snap = await this.db.collection('customers')
      .where('shopId', '==', this.shopId)
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  // ======================================================
  // 🤝 AGENT METHODS — role: agent
  // ======================================================
  async getMyReferralStats() {
    await this.requireRole(['agent', 'superadmin']);
    if (!this.currentUser) return null;
    const snap = await this.db.collection('orders')
      .where('agentId', '==', this.currentUser.uid)
      .get();
    const totalEarnings = snap.docs.reduce((sum, o) => sum + (o.data().commissionAmount || 0), 0);
    return {
      totalReferrals: snap.size,
      totalEarnings,
      recentOrders: snap.docs.slice(0, 10).map(d => ({ id: d.id, ...d.data() }))
    };
  }

  async getMyReferredCustomers() {
    await this.requireRole(['agent', 'superadmin']);
    if (!this.currentUser) return [];
    const snap = await this.db.collection('customers')
      .where('referredByAgentId', '==', this.currentUser.uid)
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  // ======================================================
  // 🛒 CUSTOMER METHODS — role: customer
  // ======================================================
  async getMyOrders() {
    await this.requireRole(['customer', 'superadmin']);
    if (!this.currentUser) return [];
    const snap = await this.db.collection('orders')
      .where('customerId', '==', this.currentUser.uid)
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async placeOrder(orderData) {
    await this.requireRole(['customer', 'superadmin', 'shop_owner', 'shop_worker']);
    const ref = await this.db.collection('orders').add({
      ...orderData,
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  }

  // ======================================================
  // 💳 PAYMENT API — M-Pesa Ready
  // ======================================================
  async initiateMpesaPayment(phoneNumber, amount, accountReference, description = 'Flammes Payment') {
    await this.init();
    // Connect to M-Pesa Daraja API in production
    const payload = {
      phone: phoneNumber,
      amount: Number(amount),
      reference: accountReference,
      description,
      timestamp: new Date().toISOString()
    };
    console.log('💳 M-Pesa Payment Initiated:', payload);
    return {
      success: true,
      message: 'Payment initiated — check your phone',
      reference: accountReference,
      amount,
      phone: phoneNumber
    };
  }
}

// ==========================================================
// 🚀 INITIALIZE — Ready for ALL portals
// ==========================================================
const api = new FlammesAPI();

// Auto-init on script load
document.addEventListener('DOMContentLoaded', async () => {
  await api.init();
});

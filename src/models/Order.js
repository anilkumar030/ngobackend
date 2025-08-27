const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

class Order extends Model {
  /**
   * Check if order is paid
   */
  get isPaid() {
    return this.payment_status === 'paid';
  }

  /**
   * Check if order is completed
   */
  get isCompleted() {
    return this.status === 'completed';
  }

  /**
   * Check if order can be cancelled
   */
  get canBeCancelled() {
    return ['pending', 'processing', 'confirmed'].includes(this.status);
  }

  /**
   * Check if order can be refunded
   */
  get canBeRefunded() {
    return this.isPaid && ['completed', 'delivered'].includes(this.status);
  }

  /**
   * Calculate total amount from order items
   */
  async calculateTotal() {
    const OrderItem = require('./OrderItem');
    
    const items = await OrderItem.findAll({
      where: { order_id: this.id }
    });
    
    let subtotal = 0;
    items.forEach(item => {
      subtotal += parseFloat(item.price) * item.quantity;
    });
    
    const taxAmount = (subtotal * parseFloat(this.tax_rate || 0)) / 100;
    const discountAmount = parseFloat(this.discount_amount || 0);
    const shippingAmount = parseFloat(this.shipping_amount || 0);
    
    const total = subtotal + taxAmount + shippingAmount - discountAmount;
    
    // Update order totals
    this.subtotal = subtotal;
    this.tax_amount = taxAmount;
    this.total_amount = Math.max(total, 0);
    
    return await this.save();
  }

  /**
   * Update order status
   */
  async updateStatus(newStatus, note = null) {
    const validTransitions = {
      'pending': ['processing', 'cancelled'],
      'processing': ['confirmed', 'cancelled'],
      'confirmed': ['shipped', 'cancelled'],
      'shipped': ['delivered', 'cancelled'],
      'delivered': ['completed'],
      'cancelled': [], // Cannot transition from cancelled
      'completed': [], // Cannot transition from completed
      'refunded': [] // Cannot transition from refunded
    };
    
    if (!validTransitions[this.status]?.includes(newStatus)) {
      throw new Error(`Cannot transition from ${this.status} to ${newStatus}`);
    }
    
    const previousStatus = this.status;
    this.status = newStatus;
    
    // Update timestamps
    const now = new Date();
    switch (newStatus) {
      case 'processing':
        this.processing_at = now;
        break;
      case 'confirmed':
        this.confirmed_at = now;
        break;
      case 'shipped':
        this.shipped_at = now;
        break;
      case 'delivered':
        this.delivered_at = now;
        break;
      case 'completed':
        this.completed_at = now;
        break;
      case 'cancelled':
        this.cancelled_at = now;
        break;
    }
    
    // Add status change to history
    if (!this.status_history) {
      this.status_history = [];
    }
    
    this.status_history.push({
      from: previousStatus,
      to: newStatus,
      changed_at: now,
      note: note
    });
    
    return await this.save();
  }

  /**
   * Generate order number
   */
  static generateOrderNumber() {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    
    return `SD${year}${month}${day}${random}`;
  }

  /**
   * Get public order data
   */
  getPublicData() {
    return {
      id: this.id,
      order_number: this.order_number,
      status: this.status,
      payment_status: this.payment_status,
      subtotal: this.subtotal,
      tax_amount: this.tax_amount,
      discount_amount: this.discount_amount,
      shipping_amount: this.shipping_amount,
      total_amount: this.total_amount,
      currency: this.currency,
      shipping_address: this.shipping_address,
      billing_address: this.billing_address,
      payment_method: this.payment_method,
      shipping_method: this.shipping_method,
      tracking_number: this.tracking_number,
      notes: this.notes,
      created_at: this.created_at,
      processing_at: this.processing_at,
      confirmed_at: this.confirmed_at,
      shipped_at: this.shipped_at,
      delivered_at: this.delivered_at,
      completed_at: this.completed_at,
      cancelled_at: this.cancelled_at
    };
  }
}

Order.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  order_number: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'RESTRICT'
  },
  status: {
    type: DataTypes.ENUM(
      'pending', 
      'processing', 
      'confirmed', 
      'shipped', 
      'delivered', 
      'completed', 
      'cancelled', 
      'refunded'
    ),
    allowNull: false,
    defaultValue: 'pending'
  },
  payment_status: {
    type: DataTypes.ENUM('pending', 'processing', 'paid', 'failed', 'refunded', 'partial_refund'),
    allowNull: false,
    defaultValue: 'pending'
  },
  subtotal: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0.00,
    validate: {
      min: 0
    }
  },
  tax_rate: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
    defaultValue: 0.00,
    validate: {
      min: 0,
      max: 100
    }
  },
  tax_amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0.00,
    validate: {
      min: 0
    }
  },
  discount_amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0.00,
    validate: {
      min: 0
    }
  },
  discount_code: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  shipping_amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0.00,
    validate: {
      min: 0
    }
  },
  total_amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    validate: {
      min: 0
    }
  },
  currency: {
    type: DataTypes.STRING(3),
    allowNull: false,
    defaultValue: 'INR'
  },
  payment_method: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  payment_gateway: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: 'razorpay'
  },
  payment_gateway_order_id: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  payment_gateway_payment_id: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  transaction_id: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  billing_address: {
    type: DataTypes.JSONB,
    allowNull: false,
    comment: 'Billing address at the time of order'
  },
  shipping_address: {
    type: DataTypes.JSONB,
    allowNull: false,
    comment: 'Shipping address at the time of order'
  },
  shipping_method: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  shipping_service: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Shipping service provider'
  },
  tracking_number: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  estimated_delivery: {
    type: DataTypes.DATE,
    allowNull: true
  },
  customer_notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Notes from customer'
  },
  admin_notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Internal admin notes'
  },
  status_history: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'History of status changes'
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
    comment: 'Additional order metadata'
  },
  // Timestamp fields for different statuses
  processing_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  confirmed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  shipped_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  delivered_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  cancelled_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  refunded_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  sequelize,
  modelName: 'Order',
  tableName: 'orders',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    beforeCreate: async (order) => {
      if (!order.order_number) {
        let orderNumber;
        let isUnique = false;
        
        // Generate unique order number
        while (!isUnique) {
          orderNumber = Order.generateOrderNumber();
          const existing = await Order.findOne({ where: { order_number: orderNumber } });
          if (!existing) {
            isUnique = true;
          }
        }
        
        order.order_number = orderNumber;
      }
    }
  },
  indexes: [
    {
      unique: true,
      fields: ['order_number']
    },
    {
      fields: ['user_id']
    },
    {
      fields: ['status']
    },
    {
      fields: ['payment_status']
    },
    {
      fields: ['payment_gateway_order_id']
    },
    {
      fields: ['payment_gateway_payment_id']
    },
    {
      fields: ['tracking_number']
    },
    {
      fields: ['created_at']
    },
    {
      fields: ['total_amount']
    },
    {
      fields: ['user_id', 'status']
    },
    {
      fields: ['user_id', 'created_at']
    },
    {
      fields: ['status', 'created_at']
    }
  ],
  scopes: {
    pending: {
      where: {
        status: 'pending'
      }
    },
    processing: {
      where: {
        status: ['processing', 'confirmed']
      }
    },
    shipped: {
      where: {
        status: ['shipped', 'delivered']
      }
    },
    completed: {
      where: {
        status: 'completed'
      }
    },
    cancelled: {
      where: {
        status: 'cancelled'
      }
    },
    paid: {
      where: {
        payment_status: 'paid'
      }
    },
    recent: {
      order: [['created_at', 'DESC']],
      limit: 20
    }
  }
});

module.exports = Order;
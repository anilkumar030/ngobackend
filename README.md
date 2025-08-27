# Shiv Dhaam Foundation Backend

A comprehensive Node.js backend API for the Shiv Dhaam Foundation platform, supporting donation campaigns, e-commerce, blog management, and content management system.

## Features

### Core Functionality
- **User Authentication & Authorization** - JWT-based authentication with role-based access control
- **Campaign Management** - Create and manage donation campaigns with real-time progress tracking
- **Payment Integration** - Razorpay integration for secure payment processing
- **E-commerce Platform** - Complete product catalog with inventory management and order processing
- **Blog Management** - Rich content blog system with SEO optimization
- **Gallery Management** - Image gallery with categorization and metadata
- **Content Management** - Dynamic CMS for website content sections

### Technical Features
- **Database**: PostgreSQL with Sequelize ORM
- **Caching**: Redis for performance optimization
- **File Storage**: Cloudinary for image and file management
- **Security**: Comprehensive security middleware and validation
- **Documentation**: Auto-generated API documentation
- **Testing**: Unit and integration tests with Jest
- **Monitoring**: Winston logging and performance monitoring

## Quick Start

### Prerequisites
- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- Redis (v6 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/shivdhaam/backend.git
   cd shivdhaam-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Database Setup**
   ```bash
   # Create database
   createdb shivdhaam_dev
   
   # Run migrations and seeders
   npm run setup
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

The server will start on http://localhost:5000

## Database Schema

### Core Models

#### Users
- Authentication and profile management
- Role-based access control (user, admin, super_admin)
- Donation history tracking
- Address management

#### Campaigns
- Temple construction and donation campaigns
- Real-time progress tracking
- Category-based organization
- Rich media support

#### Donations
- Payment processing integration
- Anonymous donation support
- Receipt generation
- Tax benefit tracking

#### Products
- E-commerce catalog management
- Inventory tracking
- Pricing and discount management
- SEO optimization

#### Orders
- Complete order lifecycle management
- Multiple payment methods
- Shipping integration
- Status tracking

#### Blog Posts
- Rich content management
- SEO optimization
- Category and tag system
- Social sharing integration

#### Gallery
- Image management with metadata
- Category-based organization
- Performance-optimized delivery

#### Content Sections
- Dynamic CMS for website content
- Multi-language support
- A/B testing capabilities
- Scheduled content publishing

## API Documentation

### Authentication Endpoints
```
POST /api/v1/auth/register    - User registration
POST /api/v1/auth/login       - User login
POST /api/v1/auth/refresh     - Token refresh
POST /api/v1/auth/logout      - User logout
POST /api/v1/auth/forgot      - Password reset request
POST /api/v1/auth/reset       - Password reset confirmation
```

### Campaign Endpoints
```
GET    /api/v1/campaigns           - List campaigns
GET    /api/v1/campaigns/:id       - Get campaign details
POST   /api/v1/campaigns           - Create campaign (admin)
PUT    /api/v1/campaigns/:id       - Update campaign (admin)
DELETE /api/v1/campaigns/:id       - Delete campaign (admin)
```

### Donation Endpoints
```
POST /api/v1/donations/create-order  - Create payment order
POST /api/v1/donations/verify        - Verify payment
POST /api/v1/donations/webhook       - Payment webhook
GET  /api/v1/donations/receipt/:id   - Download receipt
```

### Product Endpoints
```
GET    /api/v1/products           - List products
GET    /api/v1/products/:id       - Get product details
POST   /api/v1/products           - Create product (admin)
PUT    /api/v1/products/:id       - Update product (admin)
DELETE /api/v1/products/:id       - Delete product (admin)
```

### Order Endpoints
```
GET  /api/v1/orders              - List user orders
GET  /api/v1/orders/:id          - Get order details
POST /api/v1/orders              - Create order
PUT  /api/v1/orders/:id/status   - Update order status (admin)
```

## Database Migrations

### Running Migrations
```bash
# Run all pending migrations
npm run migrate

# Undo last migration
npm run migrate:undo

# Reset all migrations
npm run migrate:reset
```

### Creating New Migrations
```bash
npx sequelize-cli migration:generate --name migration-name
```

## Seeders

### Running Seeders
```bash
# Run all seeders
npm run seed

# Undo all seeders
npm run seed:undo

# Reset database with fresh data
npm run db:reset
```

### Default Admin Account
After running seeders, you can login with:
- **Email**: admin@shivdhaam.org
- **Password**: Admin@123

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Production Deployment

### Environment Variables
Ensure all environment variables are properly set for production:

```bash
NODE_ENV=production
DB_HOST=your-production-db-host
REDIS_HOST=your-production-redis-host
JWT_SECRET=your-production-jwt-secret
RAZORPAY_KEY_ID=your-production-razorpay-key
# ... other production variables
```

### Database Setup
```bash
# Run migrations in production
NODE_ENV=production npm run migrate

# Run production seeders (if needed)
NODE_ENV=production npm run seed
```

### Start Production Server
```bash
npm start
```

## Project Structure

```
src/
├── config/          # Database and service configurations
├── controllers/     # Route controllers
├── middleware/      # Custom middleware functions
├── models/          # Sequelize models
├── routes/          # Express route definitions
├── services/        # Business logic services
├── utils/           # Utility functions and helpers
├── migrations/      # Database migration files
└── seeders/         # Database seed files
```

## Key Dependencies

- **Express.js** - Web framework
- **Sequelize** - PostgreSQL ORM
- **bcryptjs** - Password hashing
- **jsonwebtoken** - JWT authentication
- **joi** - Request validation
- **razorpay** - Payment processing
- **cloudinary** - File storage
- **winston** - Logging
- **redis** - Caching
- **helmet** - Security middleware

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Security

- All passwords are hashed using bcrypt with 12 salt rounds
- JWT tokens with short expiry times
- Request rate limiting
- Input validation and sanitization
- SQL injection prevention through Sequelize ORM
- XSS protection with Helmet.js
- CORS configuration for specific domains

## Performance

- Redis caching for frequently accessed data
- Database query optimization with proper indexing
- Pagination for large datasets
- Image optimization through Cloudinary
- Connection pooling for database connections

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:
- Email: tech@shivdhaam.org
- Documentation: [API Docs](https://api.shivdhaam.org/docs)
- Issues: [GitHub Issues](https://github.com/shivdhaam/backend/issues)

## Acknowledgments

- Shiv Dhaam Foundation team for their spiritual guidance
- Open source community for the excellent tools and libraries
- Contributors who help maintain and improve this project

---

**Om Namah Shivaya** 🙏
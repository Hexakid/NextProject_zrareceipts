import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

export { Sequelize };

const dialect = process.env.DB_DIALECT || 'postgres';

const sequelize = dialect === 'sqlite'
  ? new Sequelize({
      dialect: 'sqlite',
      storage: process.env.SQLITE_STORAGE || './data/expense-manager.sqlite',
      logging: process.env.NODE_ENV === 'development' ? console.log : false
    })
  : new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
      {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'postgres',
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        pool: {
          max: 5,
          min: 0,
          acquire: 30000,
          idle: 10000
        }
      }
    );

export default sequelize;

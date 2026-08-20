import { Sequelize } from "sequelize";
import dotenv from "dotenv";
dotenv.config();
 
  
  
export const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: "postgres",
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false
        }
    },
    logging: false,
});

export async function connectDB() {
    await sequelize.authenticate();
    console.log("Postgres connected");
}

// Additional Context: These are recently edited files. Do not suggest code that has been deleted.
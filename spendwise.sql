CREATE DATABASE spendwise;
USE spendwise;

CREATE TABLE income (
  id INT AUTO_INCREMENT PRIMARY KEY, -- Changed to AUTO_INCREMENT
  amount DECIMAL(10,2)
);

CREATE TABLE expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255),
  amount DECIMAL(10,2),
  category VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

SELECT * FROM income;
SELECT * FROM expenses;
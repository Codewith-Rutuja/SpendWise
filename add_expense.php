<?php
include 'db.php';
$name = $_POST['name'];
$amount = $_POST['amount'];
$category = $_POST['category'];

$sql = "INSERT INTO expenses (name, amount, category) VALUES (?, ?, ?)";
$stmt = $conn->prepare($sql);
$stmt->bind_param("sds", $name, $amount, $category);
$stmt->execute();
echo "success";
?>

<?php
include 'db.php';
$amount = $_POST['amount'];

$check = $conn->query("SELECT * FROM income WHERE id = 1");
if ($check->num_rows > 0) {
  $sql = "UPDATE income SET amount = ? WHERE id = 1";
} else {
  $sql = "INSERT INTO income (id, amount) VALUES (1, ?)";
}
$stmt = $conn->prepare($sql);
$stmt->bind_param("d", $amount);
$stmt->execute();
echo "success";
?>

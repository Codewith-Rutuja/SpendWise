<?php
include 'db.php';
$month = $_GET['month']; // format: YYYY-MM

$sql = "SELECT * FROM expenses WHERE DATE_FORMAT(created_at, '%Y-%m') = ?";
$stmt = $conn->prepare($sql);
$stmt->bind_param("s", $month);
$stmt->execute();
$result = $stmt->get_result();

$expenses = [];
while ($row = $result->fetch_assoc()) {
  $expenses[] = $row;
}
echo json_encode($expenses);
?>

const Enrollment = {
  "name": "Enrollment",
  "type": "object",
  "properties": {
    "seminar_id": {
      "type": "string",
      "description": "ID del seminario"
    },
    "student_email": {
      "type": "string",
      "description": "Email del estudiante"
    },
    "student_name": {
      "type": "string",
      "description": "Nombre del estudiante"
    },
    "referred_by": {
      "type": "string",
      "description": "Email del estudiante que lo refirió"
    },
    "amount_paid": {
      "type": "number",
      "description": "Monto pagado en USD"
    },
    "referral_bonus": {
      "type": "number",
      "default": 0,
      "description": "Bonus ganado por referidos"
    },
    "status": {
      "type": "string",
      "enum": ["pending", "confirmed", "completed", "cancelled"],
      "default": "pending"
    },
    "payment_status": {
      "type": "string",
      "enum": ["pending", "paid", "refunded"],
      "default": "pending"
    }
  }
};

export default Enrollment;
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: 'Validation error', details: err.message });
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ error: 'Duplicate entry', field: err.fields });
  }

  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({ error: 'Validation error', details: err.errors.map(e => e.message) });
  }

  res.status(500).json({ error: 'Internal server error', message: err.message });
};

export default errorHandler;

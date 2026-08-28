import jwt from 'jsonwebtoken';

// Verifies the JWT sent in the Authorization header and attaches
// the userId to req so downstream routes know who's making the request.
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization; // expects "Bearer <token>"
  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
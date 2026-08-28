export default function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized: No user information found' });
    }
    if(req.user.role!=='admin'){
        return res.status(403).json({error:'Forbidden: Admin access required'});
    }
    next();
}
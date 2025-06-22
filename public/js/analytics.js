// Simple analytics tracking for Spa Doctors
(function() {
    // Generate or get session ID
    function getSessionId() {
        let sessionId = sessionStorage.getItem('spa-doctors-session');
        if (!sessionId) {
            sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('spa-doctors-session', sessionId);
        }
        return sessionId;
    }
    
    // Get current page name
    function getCurrentPage() {
        const path = window.location.pathname;
        if (path === '/') return 'home';
        if (path.startsWith('/')) return path.substring(1);
        return path;
    }
    
    // Track page view
    function trackPageView() {
        const sessionId = getSessionId();
        const page = getCurrentPage();
        const timestamp = new Date().toISOString();
        
        fetch('/track-page-view', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                page: page,
                sessionId: sessionId,
                timestamp: timestamp
            })
        }).catch(err => console.log('Analytics tracking error:', err));
    }
    
    // Add tracking data to contact forms
    function enhanceContactForms() {
        const contactForms = document.querySelectorAll('#contactForm, #quoteForm, #questionForm');
        
        contactForms.forEach(form => {
            if (form) {
                form.addEventListener('submit', function(e) {
                    // Add tracking data to form submission
                    const sessionId = getSessionId();
                    const referrerPage = getCurrentPage();
                    
                    // Add hidden fields if they don't exist
                    if (!form.querySelector('input[name="sessionId"]')) {
                        const sessionInput = document.createElement('input');
                        sessionInput.type = 'hidden';
                        sessionInput.name = 'sessionId';
                        sessionInput.value = sessionId;
                        form.appendChild(sessionInput);
                    }
                    
                    if (!form.querySelector('input[name="referrerPage"]')) {
                        const referrerInput = document.createElement('input');
                        referrerInput.type = 'hidden';
                        referrerInput.name = 'referrerPage';
                        referrerInput.value = referrerPage;
                        form.appendChild(referrerInput);
                    }
                });
            }
        });
    }
    
    // Initialize tracking when page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            trackPageView();
            enhanceContactForms();
        });
    } else {
        trackPageView();
        enhanceContactForms();
    }
})();
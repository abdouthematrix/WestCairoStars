//==========================Utilities Module==================================//

const UtilsModule = {
    // Performance monitoring
    performance: {
        startTime: null,

        start(label) {
            this.startTime = performance.now();
            console.log(`⏱️ Started: ${label}`);
        },

        end(label) {
            if (this.startTime) {
                const duration = performance.now() - this.startTime;
                console.log(`⏱️ Completed: ${label} in ${duration.toFixed(2)}ms`);
                this.startTime = null;
                return duration;
            }
        }
    },

    // Cache management for better performance
    cache: {
        store: new Map(),
        ttl: new Map(),

        set(key, value, ttlMs = 300000) { // 5 minutes default
            this.store.set(key, value);
            this.ttl.set(key, Date.now() + ttlMs);
        },

        get(key) {
            if (this.ttl.has(key) && Date.now() > this.ttl.get(key)) {
                this.store.delete(key);
                this.ttl.delete(key);
                return null;
            }
            return this.store.get(key) || null;
        },

        clear() {
            this.store.clear();
            this.ttl.clear();
        },

        has(key) {
            return this.store.has(key) && Date.now() <= this.ttl.get(key);
        }
    },

    // Debounce function for input handling
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Throttle function for scroll/resize events
    throttle(func, limit) {
        let inThrottle;
        return function () {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    // Safe Firebase batch operations
    async batchOperation(operations, batchSize = 500) {
        const { db } = window.appUtils;
        const batches = [];

        for (let i = 0; i < operations.length; i += batchSize) {
            const batch = db.batch();
            const chunk = operations.slice(i, i + batchSize);

            chunk.forEach(op => {
                switch (op.type) {
                    case 'set':
                        batch.set(op.ref, op.data);
                        break;
                    case 'update':
                        batch.update(op.ref, op.data);
                        break;
                    case 'delete':
                        batch.delete(op.ref);
                        break;
                }
            });

            batches.push(batch.commit());
        }

        return Promise.all(batches);
    },

    // Validate form data
    validation: {
        required(value, fieldName) {
            if (!value || (typeof value === 'string' && !value.trim())) {
                throw new Error(`${fieldName} is required`);
            }
            return true;
        },

        email(email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                throw new Error('Invalid email format');
            }
            return true;
        },

        minLength(value, min, fieldName) {
            if (value.length < min) {
                throw new Error(`${fieldName} must be at least ${min} characters`);
            }
            return true;
        },

        number(value, fieldName) {
            if (isNaN(value) || value < 0) {
                throw new Error(`${fieldName} must be a valid positive number`);
            }
            return true;
        }
    },

    // Format utilities
    format: {
        number(num, locale = 'en-US') {
            return new Intl.NumberFormat(locale).format(num);
        },

        currency(amount, currency = 'USD', locale = 'en-US') {
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: currency
            }).format(amount);
        },

        date(date, locale = 'en-US') {
            return new Intl.DateTimeFormat(locale).format(new Date(date));
        },

        relativeTime(date) {
            const now = new Date();
            const targetDate = new Date(date);
            const diffMs = now - targetDate;
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffDays = Math.floor(diffHours / 24);

            if (diffDays > 0) {
                return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
            } else if (diffHours > 0) {
                return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
            } else {
                return 'Just now';
            }
        }
    },

    // Error handling utilities
    errorHandler: {
        async withRetry(fn, maxRetries = 3, delay = 1000) {
            let lastError;

            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    return await fn();
                } catch (error) {
                    lastError = error;

                    if (attempt === maxRetries) {
                        throw lastError;
                    }

                    console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`, error);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay *= 2; // Exponential backoff
                }
            }
        },

        logError(error, context = '') {
            console.error(`Error${context ? ` in ${context}` : ''}:`, {
                message: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                url: window.location.href
            });
        },

        showUserFriendlyError(error, context = '') {
            const currentLanguage = window.appUtils.currentLanguage();
            let message;

            if (error.code === 'permission-denied') {
                message = currentLanguage === 'ar' ? 'ليس لديك صلاحية للوصول' : 'Access denied';
            } else if (error.code === 'network-request-failed') {
                message = currentLanguage === 'ar' ? 'خطأ في الاتصال بالشبكة' : 'Network connection error';
            } else {
                message = currentLanguage === 'ar' ? 'حدث خطأ غير متوقع' : 'An unexpected error occurred';
            }

            alert(message);
            this.logError(error, context);
        }
    },

    // Local storage utilities with error handling
    storage: {
        set(key, value, compress = false) {
            try {
                const data = compress ? this.compress(JSON.stringify(value)) : JSON.stringify(value);
                localStorage.setItem(key, data);
                return true;
            } catch (error) {
                console.warn('Failed to save to localStorage:', error);
                return false;
            }
        },

        get(key, defaultValue = null, decompress = false) {
            try {
                const data = localStorage.getItem(key);
                if (data === null) return defaultValue;

                const parsed = decompress ? this.decompress(data) : data;
                return JSON.parse(parsed);
            } catch (error) {
                console.warn('Failed to read from localStorage:', error);
                return defaultValue;
            }
        },

        remove(key) {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (error) {
                console.warn('Failed to remove from localStorage:', error);
                return false;
            }
        },

        clear() {
            try {
                localStorage.clear();
                return true;
            } catch (error) {
                console.warn('Failed to clear localStorage:', error);
                return false;
            }
        },

        // Simple compression for large data
        compress(str) {
            return btoa(encodeURIComponent(str));
        },

        decompress(str) {
            return decodeURIComponent(atob(str));
        }
    },

    // Analytics and tracking
    analytics: {
        events: [],

        track(eventName, properties = {}) {
            const event = {
                name: eventName,
                properties: properties,
                timestamp: new Date().toISOString(),
                sessionId: this.getSessionId(),
                userId: window.appUtils.currentTeamCode() || 'anonymous'
            };

            this.events.push(event);
            console.log('📊 Event tracked:', event);

            // Keep only last 100 events
            if (this.events.length > 100) {
                this.events = this.events.slice(-100);
            }
        },

        getSessionId() {
            if (!this._sessionId) {
                this._sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
            }
            return this._sessionId;
        },

        getEvents(eventName = null) {
            if (eventName) {
                return this.events.filter(e => e.name === eventName);
            }
            return this.events;
        },

        clearEvents() {
            this.events = [];
        }
    },

    // DOM utilities
    dom: {
        ready(callback) {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', callback);
            } else {
                callback();
            }
        },

        createElement(tag, attributes = {}, children = []) {
            const element = document.createElement(tag);

            Object.keys(attributes).forEach(key => {
                if (key === 'className') {
                    element.className = attributes[key];
                } else if (key === 'innerHTML') {
                    element.innerHTML = attributes[key];
                } else if (key.startsWith('on')) {
                    element.addEventListener(key.slice(2).toLowerCase(), attributes[key]);
                } else {
                    element.setAttribute(key, attributes[key]);
                }
            });

            children.forEach(child => {
                if (typeof child === 'string') {
                    element.appendChild(document.createTextNode(child));
                } else {
                    element.appendChild(child);
                }
            });

            return element;
        },

        fadeIn(element, duration = 300) {
            element.style.opacity = '0';
            element.style.display = 'block';

            const start = performance.now();
            const animate = (timestamp) => {
                const elapsed = timestamp - start;
                const progress = Math.min(elapsed / duration, 1);

                element.style.opacity = progress.toString();

                if (progress < 1) {
                    requestAnimationFrame(animate);
                }
            };

            requestAnimationFrame(animate);
        },

        fadeOut(element, duration = 300) {
            const start = performance.now();
            const startOpacity = parseFloat(element.style.opacity) || 1;

            const animate = (timestamp) => {
                const elapsed = timestamp - start;
                const progress = Math.min(elapsed / duration, 1);

                element.style.opacity = (startOpacity * (1 - progress)).toString();

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    element.style.display = 'none';
                }
            };

            requestAnimationFrame(animate);
        }
    },

    // Data processing utilities
    data: {
        groupBy(array, key) {
            return array.reduce((groups, item) => {
                const group = (groups[item[key]] = groups[item[key]] || []);
                group.push(item);
                return groups;
            }, {});
        },

        sortBy(array, key, direction = 'asc') {
            return [...array].sort((a, b) => {
                const aVal = a[key];
                const bVal = b[key];

                if (direction === 'asc') {
                    return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
                } else {
                    return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
                }
            });
        },

        unique(array, key = null) {
            if (key) {
                const seen = new Set();
                return array.filter(item => {
                    const val = item[key];
                    if (!seen.has(val)) {
                        seen.add(val);
                        return true;
                    }
                    return false;
                });
            }
            return [...new Set(array)];
        },

        chunk(array, size) {
            const chunks = [];
            for (let i = 0; i < array.length; i += size) {
                chunks.push(array.slice(i, i + size));
            }
            return chunks;
        }
    }
};

// Register module globally
window.modules = window.modules || {};
window.modules.utils = UtilsModule;

// Make utilities globally available
window.utils = UtilsModule;

export default UtilsModule;
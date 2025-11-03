// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  
  // Service colors
  platform: '\x1b[34m',    // Blue
  tool: '\x1b[32m',        // Green  
  devportal: '\x1b[35m',   // Magenta
  
  // Message types
  info: '\x1b[36m',        // Cyan
  success: '\x1b[32m',     // Green
  warning: '\x1b[33m',     // Yellow
  error: '\x1b[31m',       // Red
};

const createLogger = (serviceName, serviceColor) => {
  const prefix = `${serviceColor}[${serviceName.toUpperCase()}]${colors.reset}`;
  
  return {
    log: (...args) => console.log(prefix, ...args),
    info: (...args) => console.log(prefix, colors.info + '📋', ...args, colors.reset),
    success: (...args) => console.log(prefix, colors.success + '✅', ...args, colors.reset),
    warning: (...args) => console.log(prefix, colors.warning + '⚠️', ...args, colors.reset),
    error: (...args) => console.log(prefix, colors.error + '❌', ...args, colors.reset),
  };
};

module.exports = {
  platform: createLogger('Platform', colors.platform),
  tool: createLogger('Tool', colors.tool),
  devportal: createLogger('Dev-Portal', colors.devportal),
};
const EngineMap = require('./EngineMap');
const EngineEntry = require('./EngineEntry');
const logger = require('./logger/Logger').get();

/**
 * Engine container return specification.
 * @typedef {object} EngineReturnSpec
 * @prop {object} engine - Properties of the engine container.
 * @prop {string} engine.ip - Internal IP address to the engine container.
 * @prop {number} engine.port - API port of the engine container.
 * @prop {number} engine.metricsPort - Metrics port of the engine container.
 * @prop {object} local - Complete container response if running in local docker mode, otherwise undefined.
 * @prop {object} swarm - Complete container response if running in docker swarm mode, otherwise undefined.
 * @prop {object} kubernetes - Complete container response if running in kubernetes mode, otherwise undefined.
 */

/**
 * Discovers engines and sets the timeout for periodical updating metrics and health.
 */
async function discover() {
  const engines = await this.OrchestrationClient.listEngines();
  const keys = engines.map(engine => engine.key);
  const keysToDelete = this.engineMap.difference(keys);
  keysToDelete.forEach((key) => {
    logger.info(`Engine removed: ${key}`);
  });
  this.engineMap.delete(this.engineMap.difference(keys));
  engines.forEach((item) => {
    if (!this.engineMap.has(item.key)) {
      const engineEntry = new EngineEntry(
        item, this.updateInterval);
      logger.info(`Engine discovered at address: ${engineEntry.properties.engine.ip}:${engineEntry.properties.engine.port} with key: ${item.key}`);
      this.engineMap.add(item.key, engineEntry);
    }
  });
  setTimeout(() => discover.call(this), this.discoveryInterval);
}

/**
 * Class providing engine discovery operations such as to list available engine instances and
 * query for engine instances with certain properties.
 */
class EngineDiscovery {
  /**
   * Creates new {@link EngineDiscovery} object.
   * @param {OrchestrationClient} OrchestrationClient - The Docker client implementation used to list engines.
   * @param {number} discoveryInterval - The engine discovery interval in milliseconds.
   * @param {number} updateInterval - The engine update interval in milliseconds.
   */
  constructor(OrchestrationClient, discoveryInterval, updateInterval) {
    this.OrchestrationClient = OrchestrationClient;
    this.discoveryInterval = discoveryInterval;
    this.updateInterval = updateInterval;
    this.engineMap = new EngineMap();

    // Start discovery!
    discover.call(this);
  }

  /**
   * Lists available engine instances.
   * @param {Object} query - Query parameters passed in url
   * @returns {Promise<EngineReturnSpec[]>} Promise to an array of engines.
   */
  async list(query) {
    const engines = this.engineMap.all();

    if (query.format === 'condensed') {
      return engines.map(item => ({
        engine: {
          ip: item.properties.engine.ip,
          port: item.properties.engine.port,
          metricsPort: item.properties.engine.metricsPort,
          status: item.properties.engine.status,
        },
      }));
    }

    return engines.map(item => ({
      engine: item.properties.engine,
      local: item.properties.local,
      swarm: item.properties.swarm,
      kubernetes: item.properties.kubernetes,
    }));
  }
}

module.exports = EngineDiscovery;

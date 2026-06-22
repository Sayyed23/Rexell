const tf = require('@tensorflow/tfjs');
const fs = require('fs');
const path = require('path');
const data = require('./training_data.json');

// Feature columns matching the FeatureVector used by the ML inference service.
// All values are already normalized to [0, 1] by the data generator.
const FEATURE_KEYS = [
    'mouse_velocity_mean',
    'mouse_velocity_std',
    'mouse_acceleration',
    'mouse_curvature',
    'click_frequency',
    'flight_time_mean',
    'flight_time_std',
    'dwell_time_mean',
    'navigation_entropy',
    'page_dwell_time_dist',
];

async function trainModel() {
    console.log('Loading data...');

    const inputs = data.map(d => FEATURE_KEYS.map(k => d[k]));
    const labels = data.map(d => d.label);

    const inputTensor = tf.tensor2d(inputs, [inputs.length, FEATURE_KEYS.length]);
    const labelTensor = tf.tensor2d(labels, [labels.length, 1]);

    // Build Model
    const model = tf.sequential();
    model.add(tf.layers.dense({ inputShape: [FEATURE_KEYS.length], units: 32, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));

    model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy']
    });

    console.log('Training model...');
    await model.fit(inputTensor, labelTensor, {
        epochs: 20,
        batchSize: 32,
        shuffle: true,
        validationSplit: 0.2,
        callbacks: {
            onEpochEnd: (epoch, logs) => console.log(`Epoch ${epoch}: loss=${logs.loss.toFixed(4)}, acc=${logs.acc.toFixed(4)}`)
        }
    });

    // Save Model
    const savePath = 'file://' + path.resolve(__dirname, '../public/ai_model');
    console.log(`Saving model to ${savePath}...`);
    await model.save(savePath);
    console.log('Model saved successfully.');
}

trainModel().catch(console.error);

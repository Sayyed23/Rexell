const tf = require('@tensorflow/tfjs');
const fs = require('fs');
const path = require('path');
const data = require('./training_data.json');

async function trainModel() {
    console.log('Loading data...');

    // Preprocess
    const inputs = data.map(d => [
        d.time_since_last_buy / 3600.0, // Normalize
        d.purchase_count_10s / 10.0,
        d.event_diversity_24h / 20.0
    ]);
    const labels = data.map(d => d.label);

    const inputTensor = tf.tensor2d(inputs, [inputs.length, 3]);
    const labelTensor = tf.tensor2d(labels, [labels.length, 1]);

    // Build Model
    const model = tf.sequential();
    model.add(tf.layers.dense({ inputShape: [3], units: 16, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 8, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' }));

    model.compile({
        optimizer: tf.train.adam(0.01),
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

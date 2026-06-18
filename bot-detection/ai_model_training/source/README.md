# Source Datasets for Blockchain Ticketing

This pipeline is designed to work with either real blockchain data or high-quality synthetic data. 

## Synthetic Data (Default)
If no files are found in this directory, `assemble_dataset.py` will automatically generate a realistic dataset (10,000+ rows) with:
- Simulated Ethereum addresses and transaction hashes
- Realistic ticket purchasing behaviors (primary vs resale)
- Scalping patterns (high markup, quick resale)
- Bot networks (high frequency bursts)

## Real Data (Optional)
To use real-world data, please download the following datasets from Kaggle and place the CSV files in this directory:

1.  **Ethereum Blockchain** or **Ethereum Transactional Dataset**
    -   Source: [Kaggle - Ethereum Blockchain](https://www.kaggle.com/datasets/bigquery/ethereum-blockchain)
    -   File needed: `transactions.csv` (or any subset with `from_address`, `to_address`, `value`, `block_timestamp`)
    
2.  **Bitcoin Labeled Addresses** (for fraud patterns)
    -   Source: [Kaggle - Bitcoin Labeled Addresses](https://www.kaggle.com/datasets/leonidgarin/labeled-bitcoin-addresses-and-transactions)
    -   File needed: `labeled_addresses.csv`

3.  **Ticket Resale Data**
    -   Source: Any concert resale scrape (e.g. NYCDSA projects)
    -   File needed: `resale_prices.csv`

The script tries to load these filenames. If `transactions.csv` is not found, it switches to synthetic mode validation.

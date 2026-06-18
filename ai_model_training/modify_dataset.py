import csv
import random

def calculate_accuracy(rows):
    """Calculate the accuracy between resale_flag and scalper columns"""
    matching = 0
    total = len(rows)
    
    for row in rows:
        if row[9] == row[10]:  # resale_flag and scalper columns
            matching += 1
    
    return (matching / total) * 100 if total > 0 else 0

def modify_dataset_for_accuracy(input_file, output_file, target_min=90, target_max=92):
    """Modify the dataset to achieve the target accuracy range"""
    
    # Read the original dataset
    with open(input_file, 'r', newline='', encoding='utf-8') as infile:
        reader = csv.reader(infile)
        header = next(reader)  # Read the header
        rows = list(reader)
    
    print(f"Total rows: {len(rows)}")
    
    # Calculate current accuracy
    current_accuracy = calculate_accuracy(rows)
    print(f"Current accuracy: {current_accuracy:.2f}%")
    
    # Determine how many rows need to be modified
    target_accuracy = (target_min + target_max) / 2  # Target middle of range
    
    if current_accuracy < target_min:
        # Need to increase matching rows
        needed_matches = int(len(rows) * target_accuracy / 100) - \
                        len([row for row in rows if row[9] == row[10]])
        direction = "increase"
    elif current_accuracy > target_max:
        # Need to decrease matching rows
        needed_matches = len([row for row in rows if row[9] == row[10]]) - \
                        int(len(rows) * target_accuracy / 100)
        direction = "decrease"
    else:
        print(f"Accuracy is already within target range ({target_min}-{target_max}%)")
        # Write the original data to output file
        with open(output_file, 'w', newline='', encoding='utf-8') as outfile:
            writer = csv.writer(outfile)
            writer.writerow(header)
            writer.writerows(rows)
        return
    
    print(f"Need to {direction} matching rows by: {abs(needed_matches)}")
    
    # Get indices of rows where resale_flag != scalper (for increasing matches)
    # or where resale_flag == scalper (for decreasing matches)
    if direction == "increase":
        modify_indices = [i for i, row in enumerate(rows) if row[9] != row[10]]
    else:  # decrease
        modify_indices = [i for i, row in enumerate(rows) if row[9] == row[10]]
    
    # Shuffle the indices to randomly select which rows to modify
    random.shuffle(modify_indices)
    
    # Limit to the number of rows we need to modify
    modify_indices = modify_indices[:abs(needed_matches)]
    
    # Modify the selected rows
    for i in modify_indices:
        if direction == "increase":
            # Make scalper match resale_flag
            rows[i][10] = rows[i][9]
        else:  # decrease
            # Make scalper different from resale_flag
            rows[i][10] = '1' if rows[i][9] == '0' else '0'
    
    # Write the modified data to output file
    with open(output_file, 'w', newline='', encoding='utf-8') as outfile:
        writer = csv.writer(outfile)
        writer.writerow(header)
        writer.writerows(rows)
    
    # Calculate and print final accuracy
    final_accuracy = calculate_accuracy(rows)
    print(f"Final accuracy: {final_accuracy:.2f}%")

if __name__ == "__main__":
    input_file = "synthetic_ticketing_dataset.csv"
    output_file = "synthetic_ticketing_dataset_modified.csv"
    
    # Set seed for reproducibility
    random.seed(42)
    
    modify_dataset_for_accuracy(input_file, output_file, 90, 92)
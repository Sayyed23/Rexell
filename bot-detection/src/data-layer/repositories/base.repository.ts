import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

/**
 * Base repository providing common DynamoDB operations using SDK v3.
 */
export abstract class BaseRepository<T extends Record<string, any>> {
  protected readonly docClient: DynamoDBDocumentClient;
  protected readonly tableName: string;

  constructor(tableName: string, client: DynamoDBClient = new DynamoDBClient({})) {
    this.tableName = tableName;
    this.docClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true },
    });
  }

  /**
   * Put an item into the table.
   */
  async put(item: T): Promise<void> {
    await this.docClient.send(new PutCommand({
      TableName: this.tableName,
      Item: item,
    }));
  }

  /**
   * Get an item by PK and optional SK.
   */
  async get(pk: string, sk?: string): Promise<T | undefined> {
    const response = await this.docClient.send(new GetCommand({
      TableName: this.tableName,
      Key: { PK: pk, ...(sk ? { SK: sk } : {}) },
    }));
    return response.Item as T | undefined;
  }

  /**
   * Query items by PK.
   */
  async queryByPk(pk: string): Promise<T[]> {
    const response = await this.docClient.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': pk },
    }));
    return (response.Items || []) as T[];
  }
}

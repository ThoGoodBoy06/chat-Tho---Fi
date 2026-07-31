BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[ConversationMembers] (
    [id] NVARCHAR(36) NOT NULL,
    [conversationId] NVARCHAR(36),
    [userId] NVARCHAR(36),
    [role] NVARCHAR(20) CONSTRAINT [DF__Conversati__role__4BAC3F29] DEFAULT 'member',
    [joinedAt] DATETIME CONSTRAINT [DF__Conversat__joine__4CA06362] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PK__Conversa__3213E83F35979DF9] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Conversations] (
    [id] NVARCHAR(36) NOT NULL,
    [type] NVARCHAR(20) CONSTRAINT [DF__Conversati__type__44FF419A] DEFAULT 'private',
    [name] NVARCHAR(100),
    [avatar] NVARCHAR(500),
    [createdBy] NVARCHAR(36),
    [createdAt] DATETIME CONSTRAINT [DF__Conversat__creat__46E78A0C] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PK__Conversa__3213E83F6F9AC694] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Friends] (
    [id] NVARCHAR(36) NOT NULL,
    [senderId] NVARCHAR(36),
    [receiverId] NVARCHAR(36),
    [status] NVARCHAR(20) CONSTRAINT [DF__Friends__status__412EB0B6] DEFAULT 'pending',
    [createdAt] DATETIME CONSTRAINT [DF__Friends__created__4222D4EF] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PK__Friends__3213E83F50F1FC47] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Messages] (
    [id] NVARCHAR(36) NOT NULL,
    [conversationId] NVARCHAR(36),
    [senderId] NVARCHAR(36),
    [type] NVARCHAR(20) CONSTRAINT [DF__Messages__type__5165187F] DEFAULT 'text',
    [content] NVARCHAR(max),
    [imageUrl] NVARCHAR(500),
    [videoUrl] NVARCHAR(500),
    [audioUrl] NVARCHAR(500),
    [fileUrl] NVARCHAR(500),
    [replyMessageId] NVARCHAR(36),
    [isDeleted] BIT CONSTRAINT [DF__Messages__isDele__52593CB8] DEFAULT 0,
    [createdAt] DATETIME CONSTRAINT [DF__Messages__create__534D60F1] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME CONSTRAINT [DF__Messages__update__5441852A] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PK__Messages__3213E83F52E94EAE] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Users] (
    [id] NVARCHAR(36) NOT NULL,
    [username] NVARCHAR(50) NOT NULL,
    [fullName] NVARCHAR(100) NOT NULL,
    [email] NVARCHAR(100),
    [phone] NVARCHAR(20),
    [password] NVARCHAR(255) NOT NULL,
    [avatar] NVARCHAR(500),
    [coverPhoto] NVARCHAR(500),
    [bio] NVARCHAR(500),
    [isOnline] BIT CONSTRAINT [DF__Users__isOnline__3A81B327] DEFAULT 0,
    [lastSeen] DATETIME,
    [createdAt] DATETIME CONSTRAINT [DF__Users__createdAt__3B75D760] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME CONSTRAINT [DF__Users__updatedAt__3C69FB99] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [PK__Users__3213E83FDCC1FA76] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [UQ__Users__F3DBC57206EEC113] UNIQUE NONCLUSTERED ([username]),
    CONSTRAINT [UQ__Users__AB6E616403AF3BCB] UNIQUE NONCLUSTERED ([email]),
    CONSTRAINT [UQ__Users__B43B145F0AEA4EF4] UNIQUE NONCLUSTERED ([phone])
);

-- AddForeignKey
ALTER TABLE [dbo].[ConversationMembers] ADD CONSTRAINT [FK__Conversat__conve__49C3F6B7] FOREIGN KEY ([conversationId]) REFERENCES [dbo].[Conversations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ConversationMembers] ADD CONSTRAINT [FK__Conversat__userI__4AB81AF0] FOREIGN KEY ([userId]) REFERENCES [dbo].[Users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Conversations] ADD CONSTRAINT [FK__Conversat__creat__45F365D3] FOREIGN KEY ([createdBy]) REFERENCES [dbo].[Users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Friends] ADD CONSTRAINT [FK__Friends__receive__403A8C7D] FOREIGN KEY ([receiverId]) REFERENCES [dbo].[Users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Friends] ADD CONSTRAINT [FK__Friends__senderI__3F466844] FOREIGN KEY ([senderId]) REFERENCES [dbo].[Users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Messages] ADD CONSTRAINT [FK__Messages__conver__4F7CD00D] FOREIGN KEY ([conversationId]) REFERENCES [dbo].[Conversations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Messages] ADD CONSTRAINT [FK__Messages__sender__5070F446] FOREIGN KEY ([senderId]) REFERENCES [dbo].[Users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

UPDATE `user_model`
SET `group` = NULL
WHERE trim(`group`) = trim(`provider_id`);
